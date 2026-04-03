# 🔮 From Zero to GenLayer: Build an AI Sentiment Oracle

> **A step-by-step tutorial** showing you how to build a full-stack decentralised application on GenLayer — the world's first blockchain with native AI capabilities.

By the end of this tutorial, you will have deployed a **Sentiment Oracle** — an intelligent contract that uses multiple AI validators to reach consensus on the emotional sentiment of any text, with a live frontend anyone can use.

![Sentiment Oracle DApp](./.github/preview.png)

---

## 🧠 What You'll Learn

- What makes GenLayer different from traditional blockchains
- How **Optimistic Democracy** achieves consensus with AI
- How the **Equivalence Principle** enables non-deterministic computation on-chain
- How to write a **Python Intelligent Contract** using the `genlayer` SDK
- How to build a frontend that talks to your contract using **genlayer-js**
- How to deploy your frontend to **Vercel** for the world to use

---

## 📖 Table of Contents

1. [Understanding GenLayer — The Big Picture](#part-1-understanding-genlayer)
2. [The Equivalence Principle — GenLayer's Secret Weapon](#part-2-the-equivalence-principle)
3. [Setting Up Your Environment](#part-3-setting-up-your-environment)
4. [Writing the Intelligent Contract](#part-4-writing-the-intelligent-contract)
5. [Deploying the Contract in GenLayer Studio](#part-5-deploying-the-contract)
6. [Building the Frontend](#part-6-building-the-frontend)
7. [Running Locally](#part-7-running-locally)
8. [Deploying to Vercel](#part-8-deploying-to-vercel)
9. [How It All Works Together](#how-it-all-works-together)

---

## Part 1: Understanding GenLayer

Traditional smart contracts (Ethereum, Solana, etc.) have one hard rule: **every node must produce the exact same output for the exact same input**. This works perfectly for arithmetic — `2 + 2` is always `4`. But it completely blocks any real-world intelligence: you cannot call an API, you cannot run an LLM, you cannot resolve a subjective question.

**GenLayer breaks this constraint** by introducing a new consensus mechanism called **Optimistic Democracy**.

### How Optimistic Democracy Works

Instead of a single node computing a result, GenLayer selects a **committee of AI-powered validators**. Each validator:

1. Independently runs the same intelligent contract
2. Makes its own AI-powered decision (e.g. calling an LLM)
3. Submits its result to the network

The network then uses the **Equivalence Principle** to decide if the results are "close enough" to agree upon, without requiring byte-for-byte equality.

```
User submits tx
      │
      ▼
┌─────────────────────────────────────────────────┐
│              GenLayer Validator Network          │
│                                                 │
│  Validator A 🤖  Validator B 🤖  Validator C 🤖 │
│  "NEGATIVE"      "NEGATIVE"      "NEGATIVE"     │
│                                                 │
│          ✅ Equivalence check passed!           │
│          → Result committed to chain            │
└─────────────────────────────────────────────────┘
```

This is why GenLayer can run LLMs, call web APIs, and resolve subjective questions — all on-chain, with trustless consensus.

---

## Part 2: The Equivalence Principle

The **Equivalence Principle** is the core innovation that makes non-deterministic computation trustworthy.

In a traditional contract, validators check: `result_A === result_B` (exact byte equality).

In GenLayer, validators check: `is_equivalent(result_A, result_B)` — a flexible, developer-defined rule.

There are two main modes:

| Mode | How it works | When to use |
|------|-------------|-------------|
| `gl.eq_principle.strict_eq` | Validators must agree on the **semantic meaning**, not just bytes. A deterministic check verifies equivalence. | Categorical outputs like sentiment labels |
| `gl.eq_principle.get_principle` | You write custom Python logic to define what "equivalent" means | Complex custom rules |

In our Sentiment Oracle, we use `strict_eq` so that validators must agree the sentiment label is the same (e.g. all say `NEGATIVE`) before the result is committed to the chain.

---

## Part 3: Setting Up Your Environment

### Prerequisites

- **MetaMask** browser extension — [install here](https://metamask.io)
- A **GenLayer Studio** account — [sign up here](https://studio.genlayer.com)
- Basic knowledge of Python and JavaScript (no blockchain experience needed!)

### Add GenLayer Studionet to MetaMask

You'll need to add the Studionet network manually. In MetaMask, go to **Settings → Networks → Add Network** and fill in:

| Field | Value |
|-------|-------|
| Network Name | GenLayer Studionet |
| RPC URL | `https://studio.genlayer.com/api` |
| Chain ID | `61999` |
| Currency Symbol | `GEN` |
| Block Explorer | `https://studio.genlayer.com` |

> **Tip:** Your DApp frontend will do this automatically via MetaMask's `wallet_addEthereumChain` RPC call — but it's good to know the values.

### Get Testnet GEN Tokens

In [GenLayer Studio](https://studio.genlayer.com), connect your wallet and use the built-in faucet to get free GEN tokens for deploying and calling contracts.

---

## Part 4: Writing the Intelligent Contract

Create a file called `SentimentOracle.py`. This is your **Intelligent Contract** — written in Python, deployed on GenLayer.

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class SentimentOracle(gl.Contract):
    # Persistent on-chain storage: maps text → sentiment label
    results: TreeMap[str, str]

    def __init__(self):
        self.results = TreeMap[str, str]()

    def _perform_sentiment_analysis(self, text: str) -> str:
        """
        ⚠️ Non-deterministic: this calls an LLM.
        Each validator runs this independently.
        """
        prompt = f"""
        Analyze the sentiment of this text: 
        '{text}'
        
        Respond with exactly ONE of these words: POSITIVE, NEGATIVE, or NEUTRAL.
        """
        return gl.nondet.exec_prompt(prompt)

    @gl.public.write
    def analyze_text(self, text: str):
        """
        Write method — costs GEN gas, modifies state.
        Validators reach consensus using the Equivalence Principle.
        """
        # gl.eq_principle.strict_eq wraps the non-deterministic call.
        # Validators must semantically agree before the result is stored.
        sentiment = gl.eq_principle.strict_eq(
            lambda: self._perform_sentiment_analysis(text)
        )
        self.results[text] = sentiment

    @gl.public.view
    def get_sentiment(self, text: str) -> str:
        """
        View method — free to call, reads from state only.
        """
        if text in self.results:
            return self.results[text]
        return "NOT_FOUND"

    @gl.public.view
    def get_all_results(self) -> dict[str, str]:
        """Returns all analyzed texts and their consensus sentiments."""
        return dict(self.results)
```

### Key Concepts in This Contract

**`gl.Contract`** — All intelligent contracts inherit from this base class. It handles serialisation/deserialisation of your on-chain state automatically.

**`TreeMap[str, str]`** — GenLayer's persistent key-value store. Think of it as a Python `dict` that lives on-chain between transactions.

**`gl.nondet.exec_prompt(prompt)`** — This is the magic. It sends your prompt to an LLM. Each validator runs this independently, so results *may* differ — that's expected and handled by the Equivalence Principle.

**`gl.eq_principle.strict_eq(lambda: ...)`** — Wraps any non-deterministic call. Validators compare their outputs semantically. Only if they agree does the transaction succeed and state get written.

**`@gl.public.write`** — Marks a method as a state-modifying transaction. Callers pay GEN gas.

**`@gl.public.view`** — Marks a method as read-only. Callers pay nothing.

---

## Part 5: Deploying the Contract

1. Go to [studio.genlayer.com](https://studio.genlayer.com) and log in
2. Click **New Contract** or open the code editor
3. Paste your `SentimentOracle.py` code
4. Click **Deploy** and confirm the MetaMask transaction
5. **Copy your contract address** — you'll need it in the next step!

Your contract is now live on Studionet. Every call to `analyze_text` will trigger the full Optimistic Democracy consensus process across the validator network.

---

## Part 6: Building the Frontend

Your frontend is a **zero-build, plain HTML/CSS/JS** project — no Webpack, no bundler needed.

### Project Structure

```
tutorial-dapp/
├── index.html        # App shell and importmap
├── style.css         # Glassmorphic dark theme
├── main.js           # All frontend logic (ES module)
└── SentimentOracle.py
```

### `index.html` — The Shell

The key trick here is using an **importmap** to load `genlayer-js` as a native ES module from esm.sh (since the package only ships as ESM, not as a browser UMD bundle):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sentiment Oracle | GenLayer Tutorial</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
</head>
<body>
    <div class="glass-container">
        <header>
            <h1>Sentiment Oracle</h1>
            <p class="subtitle">AI-Native Intelligent Contract on GenLayer</p>
        </header>
        <main>
            <div id="connection-status" class="status-badge">
                <span class="dot red"></span>
                <span class="status-text">Disconnected</span>
            </div>
            <section class="input-section">
                <label for="text-input">What's on your mind?</label>
                <textarea id="text-input" placeholder="Enter text to analyze sentiment..." rows="4"></textarea>
                <button id="analyze-btn" class="primary-btn">Analyze with AI</button>
            </section>
            <section id="result-section" class="result-section hidden">
                <h3>Consensus Result</h3>
                <div id="sentiment-display" class="sentiment-badge">---</div>
                <p id="result-explanation">Validators are reaching consensus...</p>
            </section>
        </main>
        <footer>
            <button id="connect-wallet" class="secondary-btn">Connect Wallet</button>
        </footer>
    </div>

    <!-- ✅ Importmap: loads genlayer-js as a native ES module -->
    <script type="importmap">
    {
      "imports": {
        "genlayer-js": "https://esm.sh/genlayer-js@0.18.14"
      }
    }
    </script>
    <script type="module" src="main.js"></script>
</body>
</html>
```

> **Why the importmap?** `genlayer-js` only ships ESM — there's no old-school `<script src="...">` UMD bundle. The importmap lets us use native `import` statements in our JS without any build tool.

### `main.js` — Wallet & Contract Logic

Here is the complete annotated logic:

```js
// ES module import — works thanks to the importmap in index.html
import { createClient } from 'genlayer-js';

// ── Configuration ──────────────────────────────────────────────
const STUDIONET_RPC  = "https://studio.genlayer.com/api";
const CHAIN_ID       = 61999;
const CHAIN_ID_HEX   = `0x${CHAIN_ID.toString(16)}`;

// ✏️ Replace with your deployed contract address!
let CONTRACT_ADDRESS = localStorage.getItem('sentiment_oracle_address')
    || "YOUR_CONTRACT_ADDRESS_HERE";

let client  = null;  // GenLayer client (initialised after wallet connects)
let account = null;  // Connected wallet address

// ── DOM refs ───────────────────────────────────────────────────
const connectBtn       = document.getElementById('connect-wallet');
const analyzeBtn       = document.getElementById('analyze-btn');
const textInput        = document.getElementById('text-input');
const statusBadge      = document.getElementById('connection-status');
const statusText       = statusBadge.querySelector('.status-text');
const statusDot        = statusBadge.querySelector('.dot');
const resultSection    = document.getElementById('result-section');
const sentimentDisplay = document.getElementById('sentiment-display');
const resultExplanation= document.getElementById('result-explanation');

// ── Auto-connect if MetaMask already authorised ─────────────────
async function init() {
    if (typeof window.ethereum === 'undefined') {
        alert("Please install MetaMask to use this tutorial!");
        return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) handleAccountConnected(accounts[0]);
}

// ── Ask MetaMask for permission and switch/add network ─────────
async function connectWallet() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (currentChainId !== CHAIN_ID_HEX) await switchNetwork();
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
        if (error.code === 4902) {   // Network not in MetaMask yet — add it
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

// ── Initialise the GenLayer client once wallet is connected ────
function handleAccountConnected(addr) {
    account = addr;
    connectBtn.innerText = `Connected: ${addr.substring(0,6)}...${addr.substring(38)}`;
    statusDot.classList.replace('red', 'green');
    statusText.innerText = "Connected to Studionet";

    // createClient takes the RPC endpoint, the user's address, and
    // MetaMask's window.ethereum as the signer — no private key exposure!
    client = createClient({
        endpoint: STUDIONET_RPC,
        account:  addr,
        provider: window.ethereum
    });
}

// ── Submit a write transaction to the contract ─────────────────
async function analyzeSentiment() {
    if (!client) { alert("Please connect your wallet first!"); return; }
    const text = textInput.value.trim();
    if (!text)  { alert("Please enter some text!"); return; }

    analyzeBtn.disabled  = true;
    analyzeBtn.innerText = "Submitting to GenLayer...";
    resultSection.classList.remove('hidden');
    sentimentDisplay.innerText   = "WAITING...";
    resultExplanation.innerText  = "Transaction submitted. Waiting for AI consensus...";

    try {
        // writeContract → triggers Optimistic Democracy consensus
        const txHash = await client.writeContract({
            address:      CONTRACT_ADDRESS,
            functionName: "analyze_text",
            args:         [text]
        });

        // Wait until the network has accepted the transaction
        await client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" });

        // Fetch the consensus result
        fetchResult(text);
    } catch (error) {
        analyzeBtn.disabled  = false;
        analyzeBtn.innerText = "Analyze with AI";
        sentimentDisplay.innerText  = "ERROR";
        resultExplanation.innerText = error.message;
    }
}

// ── Poll the view method until the result is available ─────────
async function fetchResult(text) {
    sentimentDisplay.innerText = "PROCESSING...";

    // readContract → free view call, reads on-chain state
    const result = await client.readContract({
        address:      CONTRACT_ADDRESS,
        functionName: "get_sentiment",
        args:         [text]
    });

    if (result === "NOT_FOUND" || result === "PROCESSING") {
        setTimeout(() => fetchResult(text), 2000);   // poll every 2s
    } else {
        displayFinalResult(result);
    }
}

function displayFinalResult(sentiment) {
    analyzeBtn.disabled  = false;
    analyzeBtn.innerText = "Analyze with AI";
    sentimentDisplay.innerText = sentiment.toUpperCase();
    const colors = { POSITIVE: '#22c55e', NEGATIVE: '#ef4444', NEUTRAL: '#e9d5ff' };
    sentimentDisplay.style.color = colors[sentiment.toUpperCase()] || '#f1f5f9';
    resultExplanation.innerText =
        `The GenLayer AI network has reached consensus: This message is ${sentiment.toLowerCase()}.`;
}

connectBtn.addEventListener('click', connectWallet);
analyzeBtn.addEventListener('click', analyzeSentiment);
init();
```

---

## Part 7: Running Locally

Since the frontend is plain HTML/JS/CSS (no build step), you just need a static file server:

```bash
# Using npx serve — no installation required
npx serve ./tutorial-dapp -p 4500
```

Then open **http://localhost:4500** in your browser.

---

## Part 8: Deploying to Vercel

Deploying a static site to Vercel is free and takes about 60 seconds.

### Option A: Deploy via Vercel CLI

```bash
# Install the CLI once
npm install -g vercel

# From inside tutorial-dapp/
cd tutorial-dapp
vercel deploy
```

Follow the prompts. Vercel auto-detects it's a static site and deploys instantly.

### Option B: Deploy via GitHub (Recommended)

1. Push your `tutorial-dapp/` folder to a GitHub repository
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. In **Framework Preset**, choose **Other** (it's a static site)
4. Set the **Root Directory** to `tutorial-dapp`
5. Click **Deploy** — done! 🎉

### Option C: Drag & Drop

Go to [vercel.com/new](https://vercel.com/new), scroll down, and **drag your `tutorial-dapp/` folder** directly onto the page.

### `vercel.json` (optional — for clean URLs)

Add this file inside `tutorial-dapp/` if you want zero-config routing:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

---

## How It All Works Together

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│                                                                 │
│  index.html + style.css + main.js (ES Module)                  │
│       │                                                         │
│       │  import { createClient } from 'genlayer-js'            │
│       │  client.writeContract({ functionName: "analyze_text" })│
└───────┼─────────────────────────────────────────────────────────┘
        │  JSON-RPC over HTTPS
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GenLayer Studionet RPC                        │
│                 https://studio.genlayer.com/api                 │
└───────┬─────────────────────────────────────────────────────────┘
        │
        ▼  Optimistic Democracy begins
┌───────────────────────────────────────────────┐
│           AI Validator Network                 │
│                                               │
│  🤖 Validator 1          🤖 Validator 2       │
│  runs SentimentOracle.py  runs SentimentOracle.py │
│  calls LLM → "NEGATIVE"  calls LLM → "NEGATIVE"  │
│                                               │
│  Equivalence Principle check: ✅ AGREE        │
│  → Result written to on-chain TreeMap         │
└───────────────────────────────────────────────┘
        │
        ▼  client.readContract({ functionName: "get_sentiment" })
┌─────────────────────────────────────────────────┐
│  Frontend displays: NEGATIVE ✅                 │
└─────────────────────────────────────────────────┘
```

---

## 🚀 What to Build Next

You've just scratched the surface of what GenLayer enables. Here are some ideas using the same patterns you've learned:

| Project | What it does |
|---------|-------------|
| **P2P Betting Oracle** | Two friends bet on an outcome; GenLayer resolves it by checking a website |
| **Dispute Resolution Module** | A trustless arbitrator that reads both parties' claims and rules fairly |
| **On-Chain Content Moderator** | Flag submitted content as safe/unsafe via LLM consensus |
| **Performance Reviewer** | Rate the quality of completed freelance work automatically |
| **Real-World Event Oracle** | Settle prediction markets by verifying real-world events on-chain |

All of these use the same building blocks you've just mastered:
- `gl.nondet.exec_prompt()` for AI reasoning
- `gl.eq_principle` for trustless consensus
- `client.writeContract` / `client.readContract` for frontend interaction

---

## 📚 Resources

- [GenLayer Documentation](https://docs.genlayer.com)
- [GenLayer Studio](https://studio.genlayer.com)
- [genlayer-js SDK on npm](https://www.npmjs.com/package/genlayer-js)
- [GenLayer GitHub](https://github.com/genlayer)
- [GenLayer Discord](https://discord.gg/genlayer)

---

*Built with ❤️ as part of the GenLayer "From Zero to GenLayer" tutorial mission.*
