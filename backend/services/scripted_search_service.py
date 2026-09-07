import time
from typing import Dict, Any, List
from playwright.sync_api import sync_playwright

class ScriptedReverseImageSearchProvider:
    def search(self, image_url: str) -> List[Dict[str, Any]]:
        results = []
        
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
            try:
                # Use Google Lens web interface for the scripted reverse search
                search_url = f"https://lens.google.com/uploadbyurl?url={image_url}"
                page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                
                # Check for captcha or blocks
                content = page.content().lower()
                if "captcha" in content or "unusual traffic" in content:
                    raise Exception("Search provider requires human verification (CAPTCHA).")
                    
                # Wait for images to load (gives JS time to run and fetch results)
                page.wait_for_timeout(3000)
                
                # Run JS in the browser to extract candidates
                candidates = page.evaluate("""() => {
                    const extracted = [];
                    // Find all anchor tags that might be results
                    const links = document.querySelectorAll('a[href]');
                    
                    for (const a of links) {
                        const href = a.href;
                        // Skip google internal links (like search refinements, settings)
                        if (href.includes('google.com/') && !href.includes('/url?')) continue;
                        
                        // Look for an image inside the link
                        const img = a.querySelector('img');
                        if (!img || !img.src) continue;
                        if (img.src.startsWith('data:image/svg')) continue;
                        
                        // Skip tiny icons
                        if (img.clientWidth > 0 && img.clientWidth < 50) continue; 
                        
                        // Get some text around it for the title
                        let title = a.textContent.trim();
                        if (!title) {
                            const parent = a.parentElement;
                            if (parent) title = parent.textContent.trim();
                        }
                        
                        // Try to get source domain
                        let source = "Web";
                        try {
                            source = new URL(href).hostname.replace('www.', '');
                        } catch(e) {}
                        
                        extracted.push({
                            post_url: href,
                            image_url: img.src,
                            title: title || "Discovered Candidate",
                            source: source
                        });
                    }
                    return extracted;
                }""")
                
                # Filter and deduplicate
                seen_urls = set()
                for c in candidates:
                    if c["post_url"] not in seen_urls:
                        seen_urls.add(c["post_url"])
                        c["timestamp"] = str(time.time())
                        results.append(c)
                        
            except Exception as e:
                print(f"[Scripted Search] Error: {e}")
                if "CAPTCHA" in str(e).upper():
                    raise Exception("Search provider requires human verification (CAPTCHA).")
                raise Exception(f"Scripted search failed: {e}")
            finally:
                browser.close()
                
        return results
