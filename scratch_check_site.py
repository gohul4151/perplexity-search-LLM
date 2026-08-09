import urllib.request
import re

urls = [
    "https://perplexity-search-llm.vercel.app/login",
    "https://perplexity-search-idmq8eswe-gohuls-projects.vercel.app/login"
]

for url in urls:
    print(f"\n--- Checking {url} ---")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
        
        js_files = re.findall(r'src="(/_next/static/chunks/[^"]+\.js)"', html)
        print(f"Found {len(js_files)} JS chunks:")
        
        found = False
        for js_file in js_files:
            js_url = f"{url.rsplit('/', 1)[0]}{js_file}"
            # Resolve relative path correctly
            js_url = js_url.replace('/login/_next', '/_next')
            try:
                js_req = urllib.request.Request(
                    js_url,
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(js_req) as js_res:
                    js_content = js_res.read().decode('utf-8')
                    if "Terms of Service" in js_content or "agree to our" in js_content:
                        print(f"  ❌ Found 'Terms of Service' text in: {js_url}")
                        found = True
            except Exception as e:
                print(f"  Failed to fetch chunk {js_url}: {e}")
                
        if not found:
            print("  ✅ 'Terms of Service' was NOT found in this deployment!")
    except Exception as e:
        print(f"Error checking site {url}: {e}")
