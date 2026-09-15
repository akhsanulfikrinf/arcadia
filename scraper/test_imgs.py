from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('https://meionovels.com/novel/kusuriya-no-hitorigoto-ln/volume-1-chapter-1/', timeout=60000, wait_until='domcontentloaded')
    page.wait_for_timeout(2000)
    
    imgs = page.evaluate("""
    () => {
        let result = [];
        document.querySelectorAll('.reading-content img').forEach(img => {
            result.push({
                src: img.src,
                dataset_src: img.dataset.src || null,
                dataset_lazy: img.dataset.lazySrc || null
            });
        });
        return result;
    }
    """)
    print("Found", len(imgs), "images")
    for idx, img in enumerate(imgs):
        print(f"Img {idx}:", img)
    
    browser.close()
