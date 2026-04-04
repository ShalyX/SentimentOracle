// GenLayer Tutorial: Sentiment Oracle Frontend Logic
// Standard implementation using genlayer-js and client.connect("studionet")
import { createClient } from 'genlayer-js';

// CONFIGURATION
const STUDIONET_RPC = "https://studio.genlayer.com/api";
const CHAIN_ID = 61999;
const CHAIN_ID_HEX = "0xf22f";

// This is the contract address from your deployment
let CONTRACT_ADDRESS = localStorage.getItem('sentiment_oracle_address') || "0x718B8074d6735e5d16E8e285a73047a066316277";

// Contract ABI - Essential for argument encoding in viem/genlayer-js
const CONTRACT_ABI = [
    {
        type: "function",
        name: "analyze_text",
        inputs: [{ name: "text", type: "string" }],
        outputs: [],
        stateMutability: "nonpayable"
    },
    {
        type: "function",
        name: "get_sentiment",
        inputs: [{ name: "text", type: "string" }],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view"
    }
];

let client = null;
let account = null;

// DOM ELEMENTS
const connectBtn = document.getElementById('connect-wallet');
const analyzeBtn = document.getElementById('analyze-btn');
const textInput = document.getElementById('text-input');
const statusBadge = document.getElementById('connection-status');
const statusText = statusBadge.querySelector('.status-text');
const statusDot = statusBadge.querySelector('.dot');
const resultSection = document.getElementById('result-section');
const sentimentDisplay = document.getElementById('sentiment-display');
const resultExplanation = document.getElementById('result-explanation');

async function init() {
    if (typeof window.ethereum === 'undefined') {
        alert("Please install MetaMask to use this tutorial!");
        return;
    }

    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
        handleAccountConnected(accounts[0]);
    }
}

async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        handleAccountConnected(accounts[0]);
    } catch (error) {
        console.error("Connection failed:", error);
    }
}

async function handleAccountConnected(addr) {
    account = addr;
    connectBtn.innerText = `Connected: ${addr.substring(0, 6)}...${addr.substring(38)}`;
    
    try {
        // Initialize GenLayer Client
        client = createClient({
            endpoint: STUDIONET_RPC,
            account: addr,
            provider: window.ethereum
        });

        // CRITICAL: Synchronize the wallet with the Studionet network.
        // This method handles the network switch/add automatically and
        // populates the client with the required chain metadata to avoid BigInt errors.
        await client.connect("studionet");
        
        statusDot.classList.replace('red', 'green');
        statusText.innerText = "Connected to Studionet";
        console.log("GenLayer client connected to Studionet");
    } catch (err) {
        console.error("Failed to connect client:", err);
        statusDot.classList.replace('green', 'red');
        statusText.innerText = "Network Error - Switch to Studionet";
    }
}

async function analyzeSentiment() {
    if (!client) {
        alert("Please connect your wallet first!");
        return;
    }

    const text = textInput.value.trim();
    if (!text) {
        alert("Please enter some text!");
        return;
    }

    // Logic to handle contract address updates
    if (CONTRACT_ADDRESS.includes("YOUR_CONTRACT_ADDRESS") || !CONTRACT_ADDRESS.startsWith('0x')) {
        const newAddr = prompt("Please enter the deployed SentimentOracle contract address:");
        if (newAddr && newAddr.startsWith('0x')) {
            CONTRACT_ADDRESS = newAddr;
            localStorage.setItem('sentiment_oracle_address', newAddr);
        } else {
            return;
        }
    }

    try {
        analyzeBtn.disabled = true;
        analyzeBtn.innerText = "Submitting to GenLayer...";
        resultSection.classList.remove('hidden');
        sentimentDisplay.innerText = "WAITING...";
        resultExplanation.innerText = "Transaction submitted. Waiting for AI consensus...";

        // Calling 'analyze_text' (Write method)
        // By using client.connect("studionet") above, the client now has 
        // the chain metadata needed to build this transaction without BigInt errors.
        const txHash = await client.writeContract({
            address: CONTRACT_ADDRESS.trim(),
            abi: CONTRACT_ABI,
            functionName: "analyze_text",
            args: [text]
        });

        console.log("Transaction Hash:", txHash);
        resultExplanation.innerText = `Tx: ${txHash.substring(0, 10)}... — validators are processing...`;

        const receipt = await client.waitForTransactionReceipt({
            hash: txHash,
            status: "ACCEPTED",
            retries: 60,
            interval: 5000
        });

        console.log("Transaction Accepted:", receipt);
        fetchResult(text, receipt);

    } catch (error) {
        console.error("Analysis failed:", error);
        analyzeBtn.disabled = false;
        analyzeBtn.innerText = "Analyze with AI";

        if (error.message?.includes("not ACCEPTED") || error.message?.includes("UNDETERMINED")) {
            sentimentDisplay.innerText = "NO CONSENSUS";
            resultExplanation.innerText = "⚠️ Validators couldn't agree. Try shorter text.";
        } else {
            sentimentDisplay.innerText = "ERROR";
            resultExplanation.innerText = error.message;
        }
    }
}

async function fetchResult(text, receipt = null) {
    try {
        sentimentDisplay.innerText = "PROCESSING...";

        // Optimization: Try extracting result from consensus data in the receipt
        if (receipt?.consensus_data?.leader_receipt) {
            const receiptStr = JSON.stringify(receipt.consensus_data.leader_receipt);
            const found = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].find(s => receiptStr.includes(s));
            if (found) {
                displayFinalResult(found);
                return;
            }
        }

        // Standard poll via readContract
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "get_sentiment",
            args: [text]
        });

        if (result === "NOT_FOUND" || result === "PROCESSING") {
            setTimeout(() => fetchResult(text), 2000);
        } else {
            displayFinalResult(result);
        }
    } catch (error) {
        if (error.message?.includes("superfluous bytes") || error.message?.includes("RLP")) {
            setTimeout(() => fetchResult(text), 3000);
        } else {
            console.error("Fetch result failed:", error);
            resultExplanation.innerText = "Transaction accepted but result display failed.";
            analyzeBtn.disabled = false;
            analyzeBtn.innerText = "Analyze with AI";
        }
    }
}

function displayFinalResult(sentiment) {
    analyzeBtn.disabled = false;
    analyzeBtn.innerText = "Analyze with AI";
    sentimentDisplay.innerText = sentiment.toUpperCase();

    const colors = {
        'POSITIVE': '#22c55e',
        'NEGATIVE': '#ef4444',
        'NEUTRAL': '#e9d5ff'
    };

    sentimentDisplay.style.color = colors[sentiment.toUpperCase()] || '#f1f5f9';
    resultExplanation.innerText = `The GenLayer AI network has reached consensus: This message is ${sentiment.toLowerCase()}.`;
}

// EVENT LISTENERS
connectBtn.addEventListener('click', connectWallet);
analyzeBtn.addEventListener('click', analyzeSentiment);

init();