export const ROLES = {
  admin: 'Administrator',
  sales: 'Sales',
  warehouse: 'Warehouse',
};

// Who may do what. Everyone signed in can view dashboards and lists.
const RULES = {
  'products.edit': ['admin', 'warehouse'],
  'stock.adjust': ['admin', 'warehouse'],
  'partners.edit': ['admin', 'sales', 'warehouse'],
  'sales.edit': ['admin', 'sales'],
  'sales.confirm': ['admin', 'sales'],
  'sales.ship': ['admin', 'warehouse'],
  'sales.pay': ['admin', 'sales'],
  'sales.cancel': ['admin', 'sales'],
  'purchase.edit': ['admin', 'warehouse'],
  'purchase.receive': ['admin', 'warehouse'],
  'users.manage': ['admin'],
  'audit.view': ['admin'],
};

export function can(role, action) {
  return Boolean(RULES[action] && RULES[action].includes(role));
}

export const PERMISSION_TABLE = Object.entries(RULES);
