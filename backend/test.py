from google import genai
from google.genai import types

client = genai.Client(api_key="")

# Load your image
with open(r"C:\Users\ganes\Downloads\download (43).jpg", "rb") as f:
    image_bytes = f.read()

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg"
        ),
        "What is happening in this image?"  # Your text prompt
    ]
)

print(response.text)