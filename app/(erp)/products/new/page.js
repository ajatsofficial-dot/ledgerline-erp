import { requireUser } from '@/lib/auth';
import { productCategories } from '@/lib/queries';
import { Flash, PageHead } from '../../../ui';
import ProductForm from '../ProductForm';

export const metadata = { title: 'New product' };

export default async function NewProduct({ searchParams }) {
  await requireUser('products.edit');
  const categories = await productCategories();
  return (
    <>
      <PageHead eyebrow="Inventory" title="New product" />
      <Flash searchParams={searchParams} />
      <div style={{ maxWidth: 760 }}><ProductForm categories={categories} /></div>
    </>
  );
}
