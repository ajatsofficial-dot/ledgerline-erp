import { requireUser } from '@/lib/auth';
import { getSettings, listPartners, listProducts } from '@/lib/queries';
import { createPurchase } from '../../../actions';
import { PageHead } from '../../../ui';
import OrderForm from '../../OrderForm';

export const metadata = { title: 'New purchase order' };

export default async function NewPurchase({ searchParams }) {
  await requireUser('purchase.edit');
  const [settings, suppliers, products] = await Promise.all([getSettings(), listPartners('supplier'), listProducts()]);
  return (
    <>
      <PageHead eyebrow="Purchasing" title="New purchase order" />
      <OrderForm
        kind="purchase"
        action={createPurchase}
        partners={suppliers.map(({ id, name }) => ({ id, name }))}
        products={products.map(({ id, sku, name, price_cents, cost_cents, available, incoming }) => ({ id, sku, name, price_cents, cost_cents, available, incoming }))}
        currency={settings.currency}
        initialProductId={searchParams.product}
      />
    </>
  );
}
