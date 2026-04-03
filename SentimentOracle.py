# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class SentimentOracle(gl.Contract):
    # Persistent storage for sentiment analysis results
    # maps text -> sentiment_label
    results: TreeMap[str, str]

    def __init__(self):
        self.results = TreeMap[str, str]()

    def _perform_sentiment_analysis(self, text: str) -> str:
        """
        Non-deterministic LLM call to perform sentiment analysis.
        Isolating this inside a helper for the Equivalence Principle.
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
        Triggered when a user wants to analyze text.
        Reaches consensus on the sentiment using the Equivalence Principle.
        """
        # Validators will run the LLM-based logic and reach consensus
        sentiment = gl.eq_principle.strict_eq(lambda: self._perform_sentiment_analysis(text))
        
        # Store the consensus result
        self.results[text] = sentiment

    @gl.public.view
    def get_sentiment(self, text: str) -> str:
        """
        Retrieves the consolidated sentiment for a previously analyzed text.
        """
        if text in self.results:
            return self.results[text]
        return "NOT_FOUND"

    @gl.public.view
    def get_all_results(self) -> dict[str, str]:
        """
        Returns all analyzed text and their sentiments.
        """
        # TreeMap can be returned as a dict to the frontend
        return dict(self.results)
