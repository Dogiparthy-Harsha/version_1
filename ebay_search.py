#!/usr/bin/env python3
"""
eBay Product Search Script
Searches eBay products using the Browse API based on user input.
"""

import requests
import json
import base64
import os
from typing import Dict, List, Optional
import google.generativeai as genai
# from .env.example import EBAY_CLIENT_ID, EBAY_CLIENT_SECRET
# from .env import EBAY_CLIENT_ID, EBAY_CLIENT_SECRET

import os
from dotenv import load_dotenv

# This will find and read your ".env" file
load_dotenv()
EBAY_CLIENT_ID = os.environ.get("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.environ.get("EBAY_CLIENT_SECRET")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")


class eBaySearch:
    """Class to handle eBay API searches."""
    
    def __init__(self, client_id: str, client_secret: str):
        """
        Initialize eBay Search with API credentials.
        
        Args:
            client_id: eBay Application Client ID
            client_secret: eBay Application Client Secret
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        # [Corrected Code for Sandbox]
        self.base_url = "https://api.ebay.com"
        self.token_url = "https://api.ebay.com/identity/v1/oauth2/token"
        self.search_endpoint = "/buy/browse/v1/item_summary/search"
        
    def get_access_token(self) -> bool:
        """
        Get OAuth2 access token using Client Credentials Grant.
        
        Returns:
            True if token was obtained successfully, False otherwise
        """
        try:
            # Prepare credentials for Basic Authentication
            credentials = f"{self.client_id}:{self.client_secret}"
            encoded_credentials = base64.b64encode(credentials.encode()).decode()
            
            # Prepare headers
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {encoded_credentials}"
            }
            
            # Prepare body for OAuth2 token request
            data = {
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope"
            }
            
            # Make token request
            response = requests.post(self.token_url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data.get("access_token")
            
            if self.access_token:
                print("✓ Successfully obtained access token")
                return True
            else:
                print("✗ Failed to obtain access token")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"✗ Error obtaining access token: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            return False
    
    def search_items(self, query: str, limit: int = 20) -> Optional[Dict]:
        """
        Search for items on eBay.
        
        Args:
            query: Search keyword(s)
            limit: Maximum number of results to return (1-200, default: 20)
            
        Returns:
            Dictionary containing search results or None if error
        """
        if not self.access_token:
            print("✗ No access token available. Please authenticate first.")
            return None
        
        try:
            # Prepare headers with access token
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                "Content-Type": "application/json"
            }
            
            # Prepare query parameters
            params = {
                "q": query,
                "limit": min(max(limit, 1), 200)  # Ensure limit is between 1 and 200
            }
            
            # Make search request
            url = f"{self.base_url}{self.search_endpoint}"
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"✗ Error searching items: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            return None
    
    def display_results(self, results: Dict):
        """
        Display search results in a formatted way.
        
        Args:
            results: Dictionary containing search results from API
        """
        if not results:
            print("No results to display.")
            return
        
        # Extract item summaries
        item_summaries = results.get("itemSummaries", [])
        total = results.get("total", 0)
        
        print(f"\n{'='*80}")
        print(f"Found {total} item(s) on eBay")
        print(f"Displaying {len(item_summaries)} result(s):")
        print(f"{'='*80}\n")
        
        if not item_summaries:
            print("No items found matching your search criteria.")
            return
        
        for idx, item in enumerate(item_summaries, 1):
            title = item.get("title", "N/A")
            price = item.get("price", {})
            price_value = price.get("value", "N/A")
            price_currency = price.get("currency", "USD")
            
            # Get item location
            location = item.get("itemLocation", {})
            city = location.get("city", "N/A")
            state = location.get("stateOrProvince", "N/A")
            country = location.get("country", "N/A")
            
            # Get condition
            condition = item.get("condition", "N/A")
            
            # Get buying options
            buying_options = item.get("buyingOptions", [])
            buying_options_str = ", ".join(buying_options) if buying_options else "N/A"
            
            # Get item web URL
            item_web_url = item.get("itemWebUrl", "N/A")
            
            # Get shipping options
            shipping_options = item.get("shippingOptions", [])
            shipping_cost = "Free Shipping"
            if shipping_options:
                first_option = shipping_options[0]
                shipping_cost_obj = first_option.get("shippingCost", {})
                if shipping_cost_obj:
                    cost_value = shipping_cost_obj.get("value", "0")
                    cost_currency = shipping_cost_obj.get("currency", "USD")
                    if cost_value == "0":
                        shipping_cost = "Free Shipping"
                    else:
                        shipping_cost = f"{cost_value} {cost_currency}"
            
            # Display item information
            print(f"{idx}. {title}")
            print(f"   Price: {price_value} {price_currency}")
            print(f"   Shipping: {shipping_cost}")
            print(f"   Condition: {condition}")
            print(f"   Buying Options: {buying_options_str}")
            print(f"   Location: {city}, {state}, {country}")
            print(f"   URL: {item_web_url}")
            print(f"   {'-'*78}")


def main():
    """Main function to run the eBay search."""
    print("="*80)
    print("eBay AI-Powered Product Search")
    print("="*80)
    
    # --- 1. eBay Setup ---
    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        print("✗ Error: eBay Client ID and Client Secret not found in .env file.")
        return
        
    ebay = eBaySearch(EBAY_CLIENT_ID, EBAY_CLIENT_SECRET)
    print("\nAuthenticating with eBay API...")
    if not ebay.get_access_token():
        print("✗ Failed to authenticate with eBay. Please check your credentials.")
        return
        
    # --- 2. Gemini AI Setup ---
    if not GEMINI_API_KEY:
        print("✗ Error: GEMINI_API_KEY not found in .env file.")
        return
        
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-pro')
        print("✓ Successfully configured Gemini AI")
    except Exception as e:
        print(f"✗ Error configuring Gemini: {e}")
        return

    # --- 3. Main Search Loop ---
    while True:
        print("\n" + "="*80)
        
        # This is the "System Prompt" that tells the AI its job
        system_prompt = (
            "You are a helpful eBay search assistant. "
            "Your goal is to ask the user 1-2 follow-up questions to get key details "
            "(like model, color, size, condition, storage, or budget) to refine their search. "
            "Once you have enough details, your *very last* message must ONLY be the "
            "final search query, prefixed with 'FINAL_QUERY:'. "
            "For example: 'FINAL_QUERY: iPhone 15 Pro Max 256GB new'"
        )
        
        # Start a new chat session for each search
        chat = model.start_chat(history=[
            {'role': 'user', 'parts': [system_prompt]},
            {'role': 'model', 'parts': ["OK, I understand. I will help the user build a perfect search query. What are you looking for today?"]}
        ])

        print("AI: OK, I understand. I will help the user build a perfect search query.")
        
        # Get the first query from the user
        user_input = input("AI: What are you looking for today?\nYou: ").strip()

        if user_input.lower() in ['quit', 'exit', 'q']:
            print("Goodbye!")
            break

        final_query = ""

        # --- 4. Inner AI Chat Loop ---
        while True:
            try:
                # Send the user's message to the AI
                response = chat.send_message(user_input)
                ai_message = response.text.strip()
                
                # Check if the AI has decided on a final query
                if ai_message.startswith("FINAL_QUERY:"):
                    final_query = ai_message.replace("FINAL_QUERY:", "").strip()
                    print(f"\nAI: Great! I will search for: '{final_query}'")
                    break # Exit the inner chat loop
                
                # If not a final query, just print the AI's question
                print(f"\nAI: {ai_message}")
                
                # Get the user's answer
                user_input = input("You: ").strip()
                if user_input.lower() in ['quit', 'exit', 'q']:
                    break # Exit inner loop to start a new search
            
            except Exception as e:
                print(f"✗ Error communicating with Gemini: {e}")
                break # Exit inner loop

        if final_query:
            # --- 5. Search eBay with the AI-generated query ---
            limit_input = input("Number of results (1-200, default 20): ").strip()
            try:
                limit = int(limit_input) if limit_input else 20
            except ValueError:
                limit = 20
                
            print(f"\nSearching eBay for: '{final_query}'...")
            results = ebay.search_items(final_query, limit)
            
            if results:
                ebay.display_results(results)
            else:
                print("✗ Failed to retrieve search results.")
        
        # Check if user wants to search again (this is the outer loop)
        continue_search = input("\nSearch again? (y/n): ").strip().lower()
        if continue_search not in ['y', 'yes']:
            print("Goodbye!")
            break

if __name__ == "__main__":
    main()