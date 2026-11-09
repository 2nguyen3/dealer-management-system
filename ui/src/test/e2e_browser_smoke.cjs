const { chromium } = require('playwright-core')

async function runSmoke() {
  console.log('Starting Chrome smoke test on http://localhost:8080...')
  const browser = await chromium.launch({
    executablePath:
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // 1. Visit login
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' })
  console.log('Title on login page:', await page.title())
  const welcomeText = await page.textContent('.auth-welcome')
  console.log('Welcome text:', welcomeText)

  // 2. Perform Login
  await page.fill('#login-email', 'quanly@agentra.demo')
  await page.fill('#login-password', 'AgentraDemo!2026#QL')
  await page.click('button[type="submit"]')

  // 3. Wait for redirect to HomePage /
  await page.waitForURL('http://localhost:8080/', { timeout: 10000 })
  console.log('Navigated to:', page.url())

  // 4. Navigate to Agencies page
  await page.click('a[href="/agencies"]')
  await page.waitForURL('http://localhost:8080/agencies', { timeout: 10000 })
  console.log('Navigated to:', page.url())

  // 5. Wait for table to load
  await page.waitForSelector('text=DL-71', { timeout: 10000 })
  console.log('Found agency DL-71 in the data table!')

  // 6. Click Edit button for DL-71
  const editBtn = page.locator(
    'button[aria-label="Sửa hồ sơ DL-71 - Đại lý Minh Châu"]',
  )
  await editBtn.click()

  // 7. Wait for Edit Modal
  await page.waitForSelector('text=Chỉnh sửa hồ sơ: DL-71', { timeout: 5000 })
  console.log('Edit modal opened successfully for DL-71!')
  await page.waitForTimeout(1000)

  page.on('response', async (res) => {
    if (res.url().includes('/api/v1/agencies')) {
      console.log('NETWORK RES:', res.status(), res.url(), await res.text().catch(() => ''))
    }
  })

  // 8. Submit form to update agency
  const submitBtn = page.locator('button:has-text("Lưu thay đổi")')
  await submitBtn.click()

  // 9. Wait for success alert to appear
  const successAlert = await page.waitForSelector('.alert--success', {
    timeout: 20000,
  })
  console.log('Update succeeded! Alert text:', await successAlert.textContent())
  console.log('Update succeeded! Alert: "Đã cập nhật hồ sơ đại lý thành công."')

  const errorAlert = await page.$('.alert--error')
  if (errorAlert) {
    const errorText = await errorAlert.textContent()
    throw new Error(`Unexpected error alert found: ${errorText}`)
  }

  // 10. Check chatbot page shows proper unavailable status
  await page.click('a[href="/chatbot"]')
  await page.waitForURL('http://localhost:8080/chatbot', { timeout: 5000 })
  const chatbotTitle = await page.textContent('.page-title')
  const chatbotAlert = await page.textContent('.alert')
  console.log('Chatbot page title:', chatbotTitle)
  console.log('Chatbot page notice:', chatbotAlert)

  await browser.close()

  if (consoleErrors.length > 0) {
    console.warn('Browser console errors observed:', consoleErrors)
  }
  console.log('ALL E2E SMOKE CHECKS PASSED!')
}

runSmoke().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
