import redis
import requests

# Test 1: Native Redis SSL connection (often the REST token doesn't work for this, but sometimes Upstash allows password=token or a similar string)
print("Testing Native Redis...")
url = "rediss://default:gQAAAAAAAWVPAAIncDFmMmI3Nzc0MDJjMWI0MThkYWEzN2Y5NmU1OTNmNDE4YnAxOTE0NzE@flying-amoeba-91471.upstash.io:6379"

try:
    r = redis.Redis.from_url(url)
    r.ping()
    print("Native Redis logic (default user) connected successfully!")
except Exception as e:
    print("Failed with default user:", str(e))

url2 = "rediss://:gQAAAAAAAWVPAAIncDFmMmI3Nzc0MDJjMWI0MThkYWEzN2Y5NmU1OTNmNDE4YnAxOTE0NzE@flying-amoeba-91471.upstash.io:6379"
try:
    r2 = redis.Redis.from_url(url2)
    r2.ping()
    print("Native Redis logic (no user) connected successfully!")
except Exception as e:
    print("Failed with no user:", str(e))

print("Testing REST API...")
# Test 2: REST API (which the user gave exact curl for)
try:
    resp = requests.post(
        "https://flying-amoeba-91471.upstash.io/set/my-test-key", 
        headers={"Authorization": "Bearer gQAAAAAAAWVPAAIncDFmMmI3Nzc0MDJjMWI0MThkYWEzN2Y5NmU1OTNmNDE4YnAxOTE0NzE"},
        data='"my-value"'
    )
    print("REST Set Response:", resp.status_code, resp.text)
    
    resp2 = requests.get(
        "https://flying-amoeba-91471.upstash.io/get/my-test-key", 
        headers={"Authorization": "Bearer gQAAAAAAAWVPAAIncDFmMmI3Nzc0MDJjMWI0MThkYWEzN2Y5NmU1OTNmNDE4YnAxOTE0NzE"}
    )
    print("REST Get Response:", resp2.status_code, resp2.text)
except Exception as e:
    print("REST Failed:", str(e))
