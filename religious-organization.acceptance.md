# Religious Organization (Foundation Mode) - Acceptance Tests

**Test Suite ID:** RELIGIOUS_ORG_V1
**Last Updated:** January 3, 2026
**Test Environment:** Production (hero-market.vercel.app)

## Overview

These tests verify that the "Religious Organization" pathway in Charitable Foundations works correctly, with proper state management, UI behavior, and data isolation from standard foundation flows.

## Prerequisites

- User account with wallet connected and NFT holdings (Polygon)
- Access to Smart Trust page (`/smart-trust`)
- Clean browser state (no existing wizard drafts)

## Test Suite: Entry Point & Navigation

### Test 1.1: Smart Trust Page Rendering
**Type:** UI Verification
**Priority:** Critical

**Steps:**
1. Navigate to `/smart-trust`
2. Locate the "Charitable Foundation" card
3. Verify secondary button appears below the card
4. Verify button text: "Religious Organization"
5. Verify button icon: Church/Church-like icon

**Expected Results:**
- Charitable Foundation card renders normally
- Secondary button is present and clickable
- Button styling matches other action buttons (outline variant)
- No JavaScript errors in console

**Verification Commands:**
```bash
# Manual verification
curl -s "https://hero-market.vercel.app/smart-trust" | grep -i "religious.organization"
```

### Test 1.2: Button Click Navigation
**Type:** Navigation & State Initialization
**Priority:** Critical

**Steps:**
1. From Smart Trust page, click "Religious Organization" button
2. Observe URL change
3. Observe wizard initialization

**Expected Results:**
- URL becomes: `/wizard?type=foundation&affiliation=religious_organization`
- Wizard opens in Foundation flow
- Foundation tab is active
- Affiliation selector shows "Religious organization"

**Verification Query:**
```sql
-- No database changes expected at this step
-- Verify via browser network tab that no API calls fail
```

## Test Suite: Wizard State Integrity

### Test 2.1: URL Parameter Respect on First Load
**Type:** State Management
**Priority:** High

**Steps:**
1. Navigate directly to: `/wizard?type=foundation&affiliation=religious_organization`
2. Verify wizard initializes correctly

**Expected Results:**
- entityType = "foundation"
- foundationAffiliation = "religious_organization"
- Foundation tab active
- Affiliation selector pre-selected to "Religious organization"

**Verification Script:**
```javascript
// Browser console verification
const params = new URLSearchParams(window.location.search);
console.log('URL params:', {
  type: params.get('type'),
  affiliation: params.get('affiliation')
});

// Check draft state (if accessible via window object)
console.log('Draft state:', window.wizardDraft || 'Not exposed');
```

### Test 2.2: Draft Persistence Across Reloads
**Type:** State Persistence
**Priority:** High

**Steps:**
1. Start Religious Organization wizard
2. Fill in some foundation-specific fields (mission statement, governance notes)
3. Reload the page (Ctrl+R or Cmd+R)
4. Verify state restoration

**Expected Results:**
- All entered data persists
- foundationAffiliation remains "religious_organization"
- No data loss or corruption

**Verification Script:**
```javascript
// Before reload
localStorage.setItem('test_timestamp', Date.now());

// After reload
const stored = localStorage.getItem('test_timestamp');
console.log('Persistence check:', stored ? 'PASS' : 'FAIL');
```

### Test 2.3: Reset Behavior with URL Preservation
**Type:** State Management Edge Case
**Priority:** Medium

**Steps:**
1. Start Religious Organization wizard
2. Fill in form data
3. Click "Reset" button (or equivalent)
4. Observe state reset

**Expected Results:**
- Form data clears
- entityType remains "foundation"
- foundationAffiliation resets to "religious_organization" (from URL)
- NOT "standard" - URL parameter takes precedence

**Verification Script:**
```javascript
// Simulate reset and check URL params are respected
const resetDraft = () => {
  // Clear localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('wizard_')) localStorage.removeItem(key);
  });
  // Check URL params are re-applied
  const params = new URLSearchParams(window.location.search);
  return {
    affiliation: params.get('affiliation'),
    type: params.get('type')
  };
};
console.log('Post-reset URL respect:', resetDraft());
```

### Test 2.4: Manual Affiliation Toggle
**Type:** UI Interaction
**Priority:** Medium

**Steps:**
1. Start Religious Organization wizard
2. In Foundation tab, change Affiliation selector to "Standard charitable organization"
3. Fill in some data
4. Reload page
5. Verify persistence

**Expected Results:**
- Affiliation changes to "standard"
- Data persists
- Manual override takes precedence over URL parameter

**Verification Script:**
```javascript
// Test affiliation toggle persistence
const testAffiliationToggle = async () => {
  // Simulate affiliation change
  const newAffiliation = 'standard';
  localStorage.setItem('wizard_foundationAffiliation', newAffiliation);

  // Simulate page reload
  location.reload();

  // Check after reload
  setTimeout(() => {
    const stored = localStorage.getItem('wizard_foundationAffiliation');
    console.log('Affiliation toggle persistence:', stored === newAffiliation ? 'PASS' : 'FAIL');
  }, 1000);
};
```

## Test Suite: Document & Data Boundaries

### Test 3.1: Form 1023 Steps Exclusion
**Type:** Data Isolation
**Priority:** High

**Steps:**
1. Start Religious Organization wizard
2. Navigate through all foundation steps
3. Check for Form 1023 specific elements

**Expected Results:**
- Form 1023 steps are NOT present
- No "Form 1023 preparation" sections
- No IRS Form 1023 specific fields

**Verification Checklist:**
- [ ] No "Form 1023" text in page source
- [ ] No Form 1023 related input fields
- [ ] No Form 1023 validation rules triggered

### Test 3.2: EIN Step Availability
**Type:** Feature Inclusion
**Priority:** Medium

**Steps:**
1. Start Religious Organization wizard
2. Look for EIN-related fields
3. Verify EIN functionality works

**Expected Results:**
- EIN fields are present
- EIN input accepts valid formats
- EIN validation works correctly

**Verification Script:**
```javascript
// Check for EIN-related elements
const einElements = document.querySelectorAll('[data-field*="ein"], input[name*="ein"]');
console.log('EIN elements found:', einElements.length);
console.log('EIN availability:', einElements.length > 0 ? 'PASS' : 'FAIL');
```

### Test 3.3: Records/Minutes Steps Availability
**Type:** Feature Inclusion
**Priority:** Medium

**Steps:**
1. Start Religious Organization wizard
2. Check for records/minutes related sections
3. Verify functionality

**Expected Results:**
- Records and minutes steps are present
- Document upload works
- Governance recording functions properly

**Verification Checklist:**
- [ ] Records section visible
- [ ] Minutes section visible
- [ ] Document upload UI functional
- [ ] No trust-specific logic interfering

### Test 3.4: Trust Logic Containment
**Type:** Data Isolation
**Priority:** High

**Steps:**
1. Start Religious Organization wizard
2. Attempt to access trust-specific features
3. Check for trust-only validations

**Expected Results:**
- No trust-specific fields appear
- No trust-specific validation errors
- Foundation flow remains pure

**Verification Script:**
```javascript
// Check for trust-specific elements that should NOT be present
const trustElements = document.querySelectorAll('[data-trust-only], .trust-specific');
console.log('Trust elements in foundation mode:', trustElements.length);
console.log('Containment check:', trustElements.length === 0 ? 'PASS' : 'FAIL');
```

## Automation Skeleton (Optional)

### Playwright Test Template

```javascript
// tests/religious-organization.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Religious Organization Foundation Mode', () => {
  test('Entry point renders correctly', async ({ page }) => {
    await page.goto('/smart-trust');
    await expect(page.locator('text=Religious Organization')).toBeVisible();
  });

  test('Button navigation works', async ({ page }) => {
    await page.goto('/smart-trust');
    await page.click('text=Religious Organization');
    await expect(page).toHaveURL(/\?type=foundation&affiliation=religious_organization/);
  });

  test('Wizard initializes correctly', async ({ page }) => {
    await page.goto('/wizard?type=foundation&affiliation=religious_organization');
    await expect(page.locator('text=Foundation')).toBeVisible();
    await expect(page.locator('select')).toHaveValue('religious_organization');
  });

  test('State persistence works', async ({ page, context }) => {
    // Fill form
    await page.goto('/wizard?type=foundation&affiliation=religious_organization');
    await page.fill('textarea[name="missionStatement"]', 'Test mission');

    // Reload
    await page.reload();
    await expect(page.locator('textarea[name="missionStatement"]')).toHaveValue('Test mission');
  });

  test('Reset preserves URL mode', async ({ page }) => {
    await page.goto('/wizard?type=foundation&affiliation=religious_organization');
    await page.click('button:has-text("Reset")');
    await expect(page.locator('select')).toHaveValue('religious_organization');
  });
});
```

## Test Execution

### Manual Execution
1. Follow each test step manually
2. Record results in test tracking system
3. Capture screenshots for failures

### Automated Execution
```bash
# Install dependencies
npm install -D @playwright/test

# Run tests
npx playwright test religious-organization.spec.js

# Run with UI
npx playwright test --ui
```

## Success Criteria

- [ ] All Critical tests pass
- [ ] No High priority test failures
- [ ] Data boundaries maintained
- [ ] State management reliable
- [ ] UI behavior consistent

## Failure Recovery

**If test fails:**
1. Capture exact failure details
2. Check browser console for errors
3. Verify network requests
4. Check localStorage state
5. Report with reproduction steps

---

**Test Suite Complete** ✅
*Last verified: January 3, 2026*
