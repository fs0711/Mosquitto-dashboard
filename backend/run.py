"""
Run the Mosquitto Dashboard backend server using uvicorn.
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5013,
        reload=True,
        log_level="info"
    )
