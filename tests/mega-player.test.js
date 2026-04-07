const { test, expect } = require('@playwright/test');

test.describe('Mega Video Player Tests', () => {
  // Base URL for our server
  const BASE_URL = 'http://localhost:2000';
  
  test('Mega player page loads with iframe for film ID 3', async ({ page }) => {
    // Navigate directly to the Mega player page for film 3
    await page.goto(`${BASE_URL}/film/3/player`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify page title or heading
    await expect(page).toHaveTitle(/Player|Lecture/);
    
    // Check if there's an iframe (Mega player typically uses iframe)
    const iframe = page.locator('iframe');
    await expect(iframe).toBeVisible({ timeout: 10000 });
    
    // Get iframe src to verify it's a Mega link
    const iframeSrc = await iframe.getAttribute('src');
    expect(iframeSrc).toContain('mega.nz');
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/mega-player-screenshot.png' });
    
    console.log('Mega player test passed!');
    console.log(`Iframe src: ${iframeSrc}`);
  });
  
  test('Mega player page shows error for non-existent film', async ({ page }) => {
    // Try to access a film that likely doesn't exist
    await page.goto(`${BASE_URL}/film/999/player`);
    
    // Should redirect or show error
    await page.waitForLoadState('networkidle');
    
    // Either redirected to home or shows error message
    const isRedirected = page.url() === `${BASE_URL}/`;
    const hasErrorMessage = await page.locator('text=Film introuvable|Erreur|Not Found').isVisible();
    
    expect(isRedirected || hasErrorMessage).toBe(true);
  });
});