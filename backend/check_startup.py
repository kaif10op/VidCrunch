import traceback
try:
    from app.main import app
    print("FastAPI app imported successfully!")
except Exception as e:
    print("Error importing FastAPI app:")
    traceback.print_exc()
