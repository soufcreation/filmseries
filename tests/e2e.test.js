const { test, expect } = require('@playwright/test');

test.describe('Film Streaming Server E2E Tests', () => {
  // Base URL for our server
  const BASE_URL = 'http://localhost:2000';
  
  // Test data
  const TEST_USER = { username: 'admin', password: 'admin123' };
  const TEST_FILM = {
    titre: 'Test Film E2E',
    description: 'Description de test pour E2E',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    categorie: 'action'
  };
  
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test - clear cookies/storage
    await page.context().clearCookies();
    await page.goto(BASE_URL);
  });
  
  test.afterEach(async ({ page }) => {
    // Cleanup: delete any test films we created
    // This would require admin login and API calls, but for simplicity
    // we'll just note that manual cleanup might be needed
  });
  
  // Public routes tests
  test.describe('Public Routes', () => {
    test('Home page loads successfully', async ({ page }) => {
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page).toHaveTitle(/Streaming - Films en ligne/);
      await expect(page.locator('text=Films récents')).toBeVisible();
    });
    
    test('Category page loads', async ({ page }) => {
      await page.goto(BASE_URL + '/category/action');
      await expect(page).toHaveURL(BASE_URL + '/category/action');
      await expect(page.locator('text=Action')).toBeVisible();
    });
    
    test('Search functionality works', async ({ page }) => {
      await page.goto(BASE_URL + '/search?q=test');
      await expect(page).toHaveURL(BASE_URL + '/search?q=test');
      await expect(page.locator('text=Résultats pour:"test"')).toBeVisible();
    });
    
    test('Film details page loads', async ({ page }) => {
      // First get a film ID from homepage
      await page.goto(BASE_URL + '/');
      const firstFilmLink = page.locator('.film-card').first();
      await expect(firstFilmLink).toBeVisible();
      const filmHref = await firstFilmLink.getAttribute('href');
      const filmId = filmHref.split('/').pop();
      
      // Navigate to film details
      await page.goto(BASE_URL + `/film/${filmId}`);
      await expect(page).toHaveURL(BASE_URL + `/film/${filmId}`);
      await expect(page.locator('h6.film-title')).toBeVisible();
    });
    
    test('Film player page loads', async ({ page }) => {
      // Get a film ID
      await page.goto(BASE_URL + '/');
      const firstFilmLink = page.locator('.film-card').first();
      await expect(firstFilmLink).toBeVisible();
      const filmHref = await firstFilmLink.getAttribute('href');
      const filmId = filmHref.split('/').pop();
      
      // Navigate to player
      await page.goto(BASE_URL + `/film/${filmId}/player`);
      await expect(page).toHaveURL(BASE_URL + `/film/${filmId}/player`);
      await expect(page.locator('video')).toBeVisible();
    });
    
    test('Non-existent film redirects to home', async ({ page }) => {
      await page.goto(BASE_URL + '/film/999');
      await expect(page).toHaveURL(BASE_URL + '/');
    });
    
    test('Login page loads', async ({ page }) => {
      await page.goto(BASE_URL + '/login');
      await expect(page).toHaveURL(BASE_URL + '/login');
      await expect(page.locator('text=Connexion - Streaming')).toBeVisible();
      await expect(page.locator('input[name="username"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
    });
    
    test('Admin routes redirect to login when not authenticated', async ({ page }) => {
      // Test /admin
      await page.goto(BASE_URL + '/admin');
      await expect(page).toHaveURL(BASE_URL + '/login');
      
      // Test /admin/add
      await page.goto(BASE_URL + '/admin/add');
      await expect(page).toHaveURL(BASE_URL + '/login');
    });
    
    test('Non-existent route shows 404', async ({ page }) => {
      await page.goto(BASE_URL + '/nonexistent');
      await expect(page).toHaveURL(BASE_URL + '/nonexistent');
      await expect(page.locator('text=Page introuvable')).toBeVisible();
    });
  });
  
  // Authentication tests
  test.describe('Authentication', () => {
    test('Failed login shows error', async ({ page }) => {
      await page.goto(BASE_URL + '/login');
      
      await page.fill('input[name="username"]', 'wronguser');
      await page.fill('input[name="password"]', 'wrongpass');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Identifiants incorrects')).toBeVisible();
    });
    
    test('Successful login redirects to admin', async ({ page }) => {
      await page.goto(BASE_URL + '/login');
      
      await page.fill('input[name="username"]', TEST_USER.username);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL(BASE_URL + '/admin');
      await expect(page.locator('text=Tableau de bord admin')).toBeVisible();
    });
    
    test('Admin dashboard accessible after login', async ({ page }) => {
      // Login first
      await page.goto(BASE_URL + '/login');
      await page.fill('input[name="username"]', TEST_USER.username);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      
      // Check admin dashboard
      await expect(page).toHaveURL(BASE_URL + '/admin');
      await expect(page.locator('text=Films')).toBeVisible();
      await expect(page.locator('text=Ajouter un film')).toBeVisible();
    });
    
    test('Logout clears session', async ({ page }) => {
      // Login first
      await page.goto(BASE_URL + '/login');
      await page.fill('input[name="username"]', TEST_USER.username);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL(BASE_URL + '/admin');
      
      // Logout
      await page.click('text=Déconnexion');
      await expect(page).toHaveURL(BASE_URL + '/');
      
      // Try to access admin again - should redirect to login
      await page.goto(BASE_URL + '/admin');
      await expect(page).toHaveURL(BASE_URL + '/login');
    });
  });
  
  // CSRF tests
  test.describe('CSRF Protection', () => {
    test('CSRF token is present in forms', async ({ page }) => {
      await page.goto(BASE_URL + '/login');
      const csrfInput = page.locator('input[name="_csrf"]');
      await expect(csrfInput).toBeVisible();
      const tokenValue = await csrfInput.getAttribute('value');
      expect(tokenValue).toHaveLength(64); // 32 bytes hex = 64 chars
    });
    
    test('Invalid CSRF token is rejected', async ({ page }) => {
      // Login first
      await page.goto(BASE_URL + '/login');
      await page.fill('input[name="username"]', TEST_USER.username);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(BASE_URL + '/admin');
      
      // Go to add film page
      await page.goto(BASE_URL + '/admin/add');
      
      // Try to submit with invalid CSRF token
      await page.fill('input[name="titre"]', TEST_FILM.titre);
      await page.fill('input[name="description"]', TEST_FILM.description);
      await page.fill('input[name="video_url"]', TEST_FILM.video_url);
      await page.selectOption('select[name="categorie"]', TEST_FILM.categorie);
      
      // Manually set invalid CSRF token
      await page.evaluate(() => {
        document.querySelector('input[name="_csrf"]').value = 'invalid_token_12345';
      });
      
      await page.click('button[type="submit"]');
      
      // Should show error or redirect back
      await expect(page.locator('text=Token de sécurité invalide')).toBeVisible();
    });
  });
  
  // Admin functionality tests
  test.describe('Admin Functionality', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each admin test
      await page.goto(BASE_URL + '/login');
      await page.fill('input[name="username"]', TEST_USER.username);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(BASE_URL + '/admin');
    });
    
    test('Add film functionality works', async ({ page }) => {
      // Go to add film page
      await page.goto(BASE_URL + '/admin/add');
      await expect(page).toHaveURL(BASE_URL + '/admin/add');
      
      // Fill form
      await page.fill('input[name="titre"]', TEST_FILM.titre);
      await page.fill('input[name="description"]', TEST_FILM.description);
      await page.fill('input[name="video_url"]', TEST_FILM.video_url);
      await page.selectOption('select[name="categorie"]', TEST_FILM.categorie);
      
      // Submit
      await page.click('button[type="submit"]');
      
      // Should redirect to admin with success message
      await expect(page).toHaveURL(BASE_URL + '/admin');
      await expect(page.locator('text=Film ajouté')).toBeVisible();
      
      // Verify film appears in list
      await expect(page.locator(`text=${TEST_FILM.titre}`)).toBeVisible();
    });
    
    test('Edit film functionality works', async ({ page }) => {
      // First add a film to edit
      await page.goto(BASE_URL + '/admin/add');
      await page.fill('input[name="titre"]', 'Film à modifier');
      await page.fill('input[name="description"]', 'Description originale');
      await page.fill('input[name="video_url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.selectOption('select[name="categorie"]', 'action');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Film ajouté')).toBeVisible();
      
      // Find the film we just added and click edit
      const editLink = page.locator('a:has-text("Modifier")').first();
      await editLink.click();
      await expect(page).toHaveURL(/.*\/admin\/edit\/\d+/);
      
      // Update the film
      await page.fill('input[name="titre"]', 'Film modifié');
      await page.fill('input[name="description"]', 'Description mise à jour');
      await page.click('button[type="submit"]');
      
      // Should redirect to admin with success message
      await expect(page).toHaveURL(BASE_URL + '/admin');
      await expect(page.locator('text=Film modifié')).toBeVisible();
      
      // Verify film was updated
      await expect(page.locator('text=Film modifié')).toBeVisible();
      await expect(page.locator('text=Film à modifier')).not.toBeVisible();
    });
    
    test('Delete film functionality works', async ({ page }) => {
      // First add a film to delete
      await page.goto(BASE_URL + '/admin/add');
      await page.fill('input[name="titre"]', 'Film à supprimer');
      await page.fill('input[name="description"]', 'Description du film');
      await page.fill('input[name="video_url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.selectOption('select[name="categorie"]', 'action');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Film ajouté')).toBeVisible();
      
      // Find the film and click delete
      const deleteButton = page.locator('button:has-text("Supprimer")').first();
      await deleteButton.click();
      
      // Handle confirmation dialog if present
      const dialog = page.waitForEvent('dialog');
      await dialog.then(d => d.accept());
      
      // Should redirect to admin with success message
      await expect(page).toHaveURL(BASE_URL + '/admin');
      await expect(page.locator('text=Film supprimé')).toBeVisible();
      
      // Verify film is gone
      await expect(page.locator('text=Film à supprimer')).not.toBeVisible();
    });
  });
  
  // Security tests
  test.describe('Security Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Login before security tests
      await page.goto(BASE_URL + '/login');
      await page.fill('input[name="username"]', TEST_USER.username);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(BASE_URL + '/admin');
    });
    
    test('Path traversal in video URL is blocked', async ({ page }) => {
      await page.goto(BASE_URL + '/admin/add');
      
      await page.fill('input[name="titre"]', 'Test Film');
      await page.fill('input[name="description"]', 'Test desc');
      await page.fill('input[name="video_url"]', '../../etc/passwd');
      await page.selectOption('select[name="categorie"]', 'action');
      
      await page.click('button[type="submit"]');
      
      // Should show error about invalid URL
      await expect(page.locator('text=Format URL invalide')).toBeVisible();
    });
    
    test('XSS in title is escaped', async ({ page }) => {
      await page.goto(BASE_URL + '/admin/add');
      
      const xssPayload = '<script>alert(1)</script>';
      await page.fill('input[name="titre"]', xssPayload);
      await page.fill('input[name="description"]', 'Test desc');
      await page.fill('input[name="video_url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.selectOption('select[name="categorie"]', 'action');
      
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL(BASE_URL + '/admin');
      await expect(page.locator('text=Film ajouté')).toBeVisible();
      
      // Verify the script tag is escaped in the display
      const filmTitle = page.locator(`text=${xssPayload}`).first();
      await expect(filmTitle).toBeVisible();
      
      // Check that the actual HTML doesn't contain unescaped script
      const filmElement = page.locator(`text=${xssPayload}`).first();
      const innerHTML = await filmElement.evaluate(el => el.innerHTML);
      expect(innerHTML).not.toContain('<script>');
      expect(innerHTML).toContain('&lt;script&gt;');
    });
    
    test('Direct GET to delete endpoint does not work', async ({ page }) => {
      // First add a film
      await page.goto(BASE_URL + '/admin/add');
      await page.fill('input[name="titre"]', 'Film pour test DELETE');
      await page.fill('input[name="description"]', 'Test desc');
      await page.fill('input[name="video_url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.selectOption('select[name="categorie"]', 'action');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Film ajouté')).toBeVisible();
      
      // Get the film ID from the page
      const filmRow = page.locator('.film-card:has-text("Film pour test DELETE")').first();
      await expect(filmRow).toBeVisible();
      const filmLink = filmRow.locator('a').first();
      const filmHref = await filmLink.getAttribute('href');
      const filmId = filmHref.split('/').pop();
      
      // Try to delete via GET (should not work)
      await page.goto(BASE_URL + `/admin/delete/${filmId}`);
      
      // Should redirect back to admin (due to ensureAdmin middleware)
      // or show error, but film should still exist
      await expect(page.locator('text=Film pour test DELETE')).toBeVisible();
    });
  });
  
  // Final cleanup test
  test.describe('Cleanup', () => {
    test('Can access server info', async ({ page }) => {
      await page.goto(BASE_URL + '/');
      await expect(page).toHaveURL(BASE_URL + '/');
      const serverInfo = await page.evaluate(() => {
        return {
          title: document.title,
          hasNav: document.querySelector('navbar') !== null
        };
      });
      expect(serverInfo.title).toContain('Streaming');
    });
  });
});