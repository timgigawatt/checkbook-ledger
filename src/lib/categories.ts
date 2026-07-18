export interface Category {
  id: string
  name: string
  icon: string
  kind: 'expense' | 'income' | 'either'
}

/**
 * Fixed category list, mirroring the original app's hardcoded categories
 * (its RealmCategory table was always empty — names were app constants).
 */
export const CATEGORIES: Category[] = [
  { id: 'cat_groceries', name: 'Groceries', icon: '🛒', kind: 'expense' },
  { id: 'cat_dining', name: 'Dining', icon: '🍽️', kind: 'expense' },
  { id: 'cat_gas', name: 'Gas', icon: '⛽', kind: 'expense' },
  { id: 'cat_household', name: 'Household', icon: '🏠', kind: 'expense' },
  { id: 'cat_housing', name: 'Housing', icon: '🏘️', kind: 'expense' },
  { id: 'cat_mortgage', name: 'Mortgage Payment', icon: '🏦', kind: 'expense' },
  { id: 'cat_utilities', name: 'Utilities', icon: '💡', kind: 'expense' },
  { id: 'cat_medical', name: 'Medical', icon: '🩺', kind: 'expense' },
  { id: 'cat_insurance', name: 'Insurance', icon: '🛡️', kind: 'expense' },
  { id: 'cat_auto', name: 'Auto', icon: '🚗', kind: 'expense' },
  { id: 'cat_entertainment', name: 'Entertainment', icon: '🎬', kind: 'expense' },
  { id: 'cat_subscriptions', name: 'Subscriptions', icon: '📺', kind: 'expense' },
  { id: 'cat_shopping', name: 'Shopping', icon: '🛍️', kind: 'expense' },
  { id: 'cat_clothing', name: 'Clothing', icon: '👕', kind: 'expense' },
  { id: 'cat_travel', name: 'Travel', icon: '✈️', kind: 'expense' },
  { id: 'cat_education', name: 'Education', icon: '🎓', kind: 'expense' },
  { id: 'cat_personal', name: 'Personal Care', icon: '💇', kind: 'expense' },
  { id: 'cat_kids', name: 'Kids', icon: '🧸', kind: 'expense' },
  { id: 'cat_pets', name: 'Pets', icon: '🐾', kind: 'expense' },
  { id: 'cat_gifts', name: 'Gifts', icon: '🎁', kind: 'expense' },
  { id: 'cat_charity', name: 'Charity', icon: '❤️', kind: 'expense' },
  { id: 'cat_taxes', name: 'Taxes', icon: '🧾', kind: 'expense' },
  { id: 'cat_fees', name: 'Fees & Charges', icon: '🏷️', kind: 'expense' },
  { id: 'cat_income', name: 'Income', icon: '💵', kind: 'income' },
  { id: 'cat_paycheck', name: 'Paycheck', icon: '💰', kind: 'income' },
  { id: 'cat_interest', name: 'Interest', icon: '🪙', kind: 'income' },
  { id: 'cat_refund', name: 'Refund', icon: '↩️', kind: 'income' },
  { id: 'cat_transfer', name: 'Transfer', icon: '🔁', kind: 'either' },
  { id: 'cat_other', name: 'Other', icon: '📌', kind: 'either' },
]

const byId = new Map(CATEGORIES.map((c) => [c.id, c]))
const byName = new Map(CATEGORIES.map((c) => [c.name.toLowerCase(), c]))

export const OTHER_CATEGORY_ID = 'cat_other'
export const TRANSFER_CATEGORY_ID = 'cat_transfer'
export const DEFAULT_EXPENSE_CATEGORY_ID = OTHER_CATEGORY_ID
export const DEFAULT_INCOME_CATEGORY_ID = 'cat_income'

export function getCategory(id: string): Category {
  return byId.get(id) ?? (byId.get(OTHER_CATEGORY_ID) as Category)
}

/** Resolve an imported category to one of ours, by id then by name. */
export function resolveImportedCategory(
  id: string | undefined,
  name: string | undefined,
): string {
  if (id && byId.has(id)) return id
  if (name) {
    const match = byName.get(name.trim().toLowerCase())
    if (match) return match.id
  }
  return OTHER_CATEGORY_ID
}

/** Display name for a transaction: known category, or preserved import name. */
export function categoryLabel(categoryId: string, categoryName?: string): string {
  const cat = byId.get(categoryId)
  if (cat && (cat.id !== OTHER_CATEGORY_ID || !categoryName)) return cat.name
  return categoryName || cat?.name || 'Other'
}
