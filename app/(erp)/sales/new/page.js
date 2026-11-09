import { requireUser } from '@/lib/auth';
import { getSettings, listPartners, listProducts } from '@/lib/queries';
import { createSale } from '../../../actions';
import { PageHead } from '../../../ui';
import OrderForm from '../../OrderForm';

export const metadata = { title: 'New sales order' };

export default async function NewSale() {
  await requireUser('sales.edit');
  const [settings, customers, products] = await Promise.all([getSettings(), listPartners('customer'), listProducts()]);
  return (
    <>
      <PageHead eyebrow="Sales" title="New sales order" />
      <OrderForm
        kind="sale"
        action={createSale}
        partners={customers.map(({ id, name }) => ({ id, name }))}
        products={products.filter((p) => p.active).map(({ id, sku, name, price_cents, cost_cents, available, incoming }) => ({ id, sku, name, price_cents, cost_cents, available, incoming }))}
        taxRate={settings.taxRate}
        currency={settings.currency}
      />
    </>
  );
}
