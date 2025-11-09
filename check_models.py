import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("✗ Error: GEMINI_API_KEY not found in .env file.")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("✓ Successfully configured API key.")
        print("Fetching available models...\n")

        # This is the ListModels function
        # We will loop through every model and print the ones
        # that support the "generateContent" method

        found_models = False
        for model in genai.list_models():
            if 'generateContent' in model.supported_generation_methods:
                print(model.name)
                found_models = True

        if not found_models:
            print("✗ No models found for 'generateContent'.")
        else:
            print("\nDone. Please use one of the model names listed above.")
            print("For example, if you see 'models/gemini-1.0-pro', use that.")

    except Exception as e:
        print(f"✗ An error occurred: {e}")