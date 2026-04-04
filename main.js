// GenLayer Tutorial: Sentiment Oracle Frontend Logic
// Using genlayer-js SDK
import { createClient } from 'genlayer-js';

// CONFIGURATION
const STUDIONET_RPC = "https://studio.genlayer.com/api";
const CHAIN_ID = 61999;
const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

// Replace this with your actual contract address after deployment in GenLayer Studio
let CONTRACT_ADDRESS = localStorage.getItem('sentiment_oracle_address') || "0xdDCBB61f9D31b62603DDaA52cb5BaD05B18C359f";

// Contract ABI - Required for stable encoding in viem
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

// INITIALIZATION
async function init() {
    if (typeof window.ethereum === 'undefined') {
        alert("Please install MetaMask to use this tutorial!");
        return;
    }

    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
        await handleAccountConnected(accounts[0]);
    }
}

async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        await handleAccountConnected(accounts[0]);
    } catch (error) {
        console.error("Connection failed:", error);
    }
}

async function handleAccountConnected(addr) {
    account = addr;
    connectBtn.innerText = `Connected: ${addr.substring(0, 6)}...${addr.substring(38)}`;
    statusDot.classList.replace('red', 'green');
    statusText.innerText = "Connected to Studionet";

    try {
        // Initialize GenLayer Client
        client = createClient({
            endpoint: STUDIONET_RPC,
            account: addr,
            provider: window.ethereum
        });

        // Sync with Studionet - this adds/switches the network automatically
        await client.connect("studionet");
        console.log("GenLayer client synchronized with Studionet");
    } catch (err) {
        console.error("Failed to connect client:", err);
        statusDot.classList.replace('green', 'red');
        statusText.innerText = "Network Error";
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

    // Strict validation of contract address
    const cleanAddr = CONTRACT_ADDRESS.trim();
    if (cleanAddr.includes("YOUR_CONTRACT_ADDRESS") || !cleanAddr.startsWith('0x') || cleanAddr.length !== 42) {
        const newAddr = prompt("Please enter a valid deployed contract address:");
        if (newAddr && newAddr.startsWith('0x') && newAddr.length === 42) {
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
        // Explicitly providing gas and gasPrice to avoid estimation errors on Studionet
        const txHash = await client.writeContract({
            address: CONTRACT_ADDRESS.trim(),
            abi: CONTRACT_ABI,
            functionName: "analyze_text",
            args: [text],
            gas: BigInt(1000000),
            gasPrice: BigInt(0)
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
            sentimentDisplay.style.color = "#f59e0b";
            resultExplanation.innerText = "⚠️ Validators couldn't agree on a sentiment. Try shorter text.";
        } else {
            sentimentDisplay.innerText = "ERROR";
            resultExplanation.innerText = error.message;
        }
    }
}

async function fetchResult(text, receipt = null) {
    try {
        sentimentDisplay.innerText = "PROCESSING...";

        // Extraction from receipt consensus data
        if (receipt?.consensus_data?.leader_receipt) {
            const receiptStr = JSON.stringify(receipt.consensus_data.leader_receipt);
            const found = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].find(s => receiptStr.includes(s));
            if (found) {
                displayFinalResult(found);
                return;
            }
        }

        // Fallback to readContract view call
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