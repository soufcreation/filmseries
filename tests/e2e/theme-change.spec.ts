import { test, expect } from '@playwright/test'

test.describe('Theme Change Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin first
    await page.goto('/login')
    await page.fill('[data-testid="username-input"]', 'admin')
    await page.fill('[data-testid="password-input"]', 'admin123')
    await page.click('[data-testid="login-button"]')
    
    // Wait for redirect to admin dashboard
    await expect(page).toHaveURL('/admin')
  })

  test('should change primary and secondary colors', async ({ page }) => {
    // Navigate to settings page
    await page.goto('/admin/settings')
    await expect(page).toHaveURL('/admin/settings')
    await expect(page.locator('h1')).toHaveText('Paramètres du site')
    
    // Store original colors for verification later
    const originalPrimaryColor = await page.locator('#primaryPreview').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    const originalSecondaryColor = await page.locator('#secondaryPreview').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    
    // Change primary color to blue
    await page.fill('#primaryColor', '#0066cc')
    
    // Change secondary color to dark gray
    await page.fill('#secondaryColor', '#333333')
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Enregistrer")')
    
    // Wait for success message
    await expect(page.locator('.alert-success')).toContainText('Paramètres du site enregistrés')
    
    // Verify colors have changed in preview
    const newPrimaryColor = await page.locator('#primaryPreview').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    const newSecondaryColor = await page.locator('#secondaryPreview').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    
    // Verify colors actually changed (not equal to original)
    expect(newPrimaryColor).not.toBe(originalPrimaryColor)
    expect(newSecondaryColor).not.toBe(originalSecondaryColor)
    
    // Verify specific new colors (accounting for possible format differences)
    expect(newPrimaryColor).toContain('0')
    expect(newPrimaryColor).toContain('102') // 0x66 = 102
    expect(newPrimaryColor).toContain('204') // 0xcc = 204
    
    expect(newSecondaryColor).toContain('51') // 0x33 = 51
    expect(newSecondaryColor).toContain('51') // 0x33 = 51
    expect(newSecondaryColor).toContain('51') // 0x33 = 51
    
    // Verify colors are reflected in the badge elements
    const primaryBadgeColor = await page.locator('#primaryBadge').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    const secondaryBadgeColor = await page.locator('#secondaryBadge').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    
    expect(primaryBadgeColor).toContain('0')
    expect(primaryBadgeColor).toContain('102')
    expect(primaryBadgeColor).toContain('204')
    
    expect(secondaryBadgeColor).toContain('51')
    expect(secondaryBadgeColor).toContain('51')
    expect(secondaryBadgeColor).toContain('51')
  })
  
  test('should persist theme changes after navigation', async ({ page }) => {
    // Set new theme colors
    await page.goto('/admin/settings')
    await page.fill('#primaryColor', '#ff0000') // Red
    await page.fill('#secondaryColor', '#00ff00') // Green
    await page.click('button[type="submit"]:has-text("Enregistrer")')
    await expect(page.locator('.alert-success')).toContainText('Paramètres du site enregistrés')
    
    // Navigate away and back to settings
    await page.goto('/admin')
    await page.goto('/admin/settings')
    
    // Verify colors persist
    const primaryColorValue = await page.inputValue('#primaryColor')
    const secondaryColorValue = await page.inputValue('#secondaryColor')
    
    expect(primaryColorValue).toBe('#ff0000')
    expect(secondaryColorValue).toBe('#00ff00')
    
    // Also verify preview elements
    const primaryPreviewColor = await page.locator('#primaryPreview').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    const secondaryPreviewColor = await page.locator('#secondaryPreview').evaluate(el => 
      getComputedStyle(el).backgroundColor
    )
    
    expect(primaryPreviewColor).toContain('255') // Red
    expect(primaryPreviewColor).toContain('0')
    expect(primaryPreviewColor).toContain('0')
    
    expect(secondaryPreviewColor).toContain('0')
    expect(secondaryPreviewColor).toContain('255') // Green
    expect(secondaryPreviewColor).toContain('0')
  })
})
