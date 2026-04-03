// GenLayer Tutorial: Sentiment Oracle Frontend Logic
// Using genlayer-js SDK
import { createClient } from 'genlayer-js';

// CONFIGURATION
const STUDIONET_RPC = "https://studio.genlayer.com/api";
const CHAIN_ID = 61999;
const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

// Replace this with your actual contract address after deployment in GenLayer Studio
let CONTRACT_ADDRESS = localStorage.getItem('sentiment_oracle_address') || "0xdDCBB61f9D31b62603DDaA52cb5BaD05B18C359f";

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

    // Try to auto-connect if already authorized
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
        handleAccountConnected(accounts[0]);
    }
}

// WALLET CONNECTION
async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Ensure we're on the right network
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== CHAIN_ID_HEX) {
            await switchNetwork();
        }

        handleAccountConnected(accounts[0]);
    } catch (error) {
        console.error("Connection failed:", error);
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CHAIN_ID_HEX }],
        });
    } catch (error) {
        if (error.code === 4902) {
            // Network not added, add it
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: CHAIN_ID_HEX,
                    chainName: "GenLayer Studionet",
                    rpcUrls: [STUDIONET_RPC],
                    nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 }
                }]
            });
        }
    }
}

async function handleAccountConnected(addr) {
    account = addr;
    connectBtn.innerText = `Connected: ${addr.substring(0, 6)}...${addr.substring(38)}`;
    statusDot.classList.replace('red', 'green');
    statusText.innerText = "Connected to Studionet";

    try {
        // Initialize GenLayer Client without manual chain object to avoid BigInt errors
        client = createClient({
            endpoint: STUDIONET_RPC,
            account: addr,
            provider: window.ethereum
        });

        // Use the official SDK method to sync the wallet with Studionet
        // This handles chainId validation and network switching safely
        await client.connect("studionet");
        console.log("GenLayer client connected to Studionet:", client);
    } catch (err) {
        console.error("Failed to connect client to Studionet:", err);
        statusDot.classList.replace('green', 'red');
        statusText.innerText = "Network Error";
    }
}

// CONTRACT INTERACTION
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

    if (CONTRACT_ADDRESS.includes("YOUR_CONTRACT_ADDRESS")) {
        const newAddr = prompt("Please enter the deployed SentimentOracle contract address:");
        if (newAddr) {
            CONTRACT_ADDRESS = newAddr;
            localStorage.setItem('sentiment_oracle_address', newAddr);
        } else {
            return;
        }
    }

    // Pre-flight check: Ensure wallet is still on Studionet
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId !== CHAIN_ID_HEX) {
        console.warn("Chain mismatch detected before transaction. Attempting switch...");
        await switchNetwork();
    }

    try {
        analyzeBtn.disabled = true;
        analyzeBtn.innerText = "Submitting to GenLayer...";
        resultSection.classList.remove('hidden');
        sentimentDisplay.innerText = "WAITING...";
        resultExplanation.innerText = "Transaction submitted. Waiting for AI consensus...";

        // Calling 'analyze_text' (Write method)
        const txHash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: "analyze_text",
            args: [text]
        });

        console.log("Transaction Hash:", txHash);
        resultExplanation.innerText = `Tx: ${txHash.substring(0, 10)}... — validators are processing...`;

        // Wait for receipt — use generous retries like TrustScan does for stability
        const receipt = await client.waitForTransactionReceipt({
            hash: txHash,
            status: "ACCEPTED",
            retries: 120,
            interval: 5000
        });

        console.log("Transaction Accepted:", receipt);

        // Try to extract result from the receipt's consensus data first,
        // then fall back to a readContract poll
        fetchResult(text, receipt);

    } catch (error) {
        console.error("Analysis failed:", error);
        analyzeBtn.disabled = false;
        analyzeBtn.innerText = "Analyze with AI";

        // Give a meaningful message based on what went wrong
        if (error.message?.includes("not ACCEPTED") || error.message?.includes("UNDETERMINED")) {
            sentimentDisplay.innerText = "NO CONSENSUS";
            sentimentDisplay.style.color = "#f59e0b";
            resultExplanation.innerText =
                "⚠️ Validators couldn't agree on a sentiment — this often happens with ambiguous or very long text. " +
                "Try shorter, clearer text and submit again.";
        } else {
            sentimentDisplay.innerText = "ERROR";
            resultExplanation.innerText = error.message;
        }
    }
}

async function fetchResult(text, receipt = null) {
    try {
        sentimentDisplay.innerText = "PROCESSING...";

        // ── Layer 1: Extract directly from the receipt consensus data ──────────
        // This avoids a second RPC round-trip entirely
        if (receipt?.consensus_data?.leader_receipt) {
            const receiptStr = JSON.stringify(receipt.consensus_data.leader_receipt);
            const found = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'].find(s => receiptStr.includes(s));
            if (found) {
                console.log("Result extracted from receipt consensus data:", found);
                displayFinalResult(found);
                return;
            }
        }

        // ── Layer 2: Standard readContract view call ──────────────────────────
        const result = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_sentiment",
            args: [text]
        });

        if (result === "NOT_FOUND" || result === "PROCESSING") {
            setTimeout(() => fetchResult(text), 2000);
        } else {
            displayFinalResult(result);
        }
    } catch (error) {
        // ── Layer 3: Handle known RLP decode bug in genlayer-js ───────────────
        // The write already succeeded (ACCEPTED) — the data IS on-chain.
        // Retry the view call with backoff until it resolves.
        if (error.message?.includes("superfluous bytes") || error.message?.includes("RLP")) {
            console.warn("RLP decode error on readContract — retrying in 3s...");
            setTimeout(() => fetchResult(text), 3000);
        } else {
            console.error("Fetch result failed:", error);
            resultExplanation.innerText =
                "Your transaction was ACCEPTED on-chain ✅ but result display failed. " +
                "Re-enter the same text and click Analyze to retrieve it.";
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

// Start
init();
