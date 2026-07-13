-- UNO RÓBE: выполните в Supabase → SQL Editor

create table if not exists products (
  id text primary key,
  sku text not null,
  title text default '',
  title_ru text not null,
  description text default '',
  price numeric not null default 0,
  image text default '',
  category text default 'midi',
  category_ru text default 'Миди',
  color text default 'other',
  color_ru text default 'Другой',
  available boolean default true,
  track_sizes boolean default false,
  sizes jsonb default '[]'::jsonb,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists reviews (
  id text primary key,
  author text not null,
  text text not null,
  rating int default 5,
  approved boolean default false,
  created_at timestamptz default now()
);

alter table products enable row level security;
alter table reviews enable row level security;

create policy "products_public_read" on products for select using (active = true);
create policy "products_admin_all" on products for all using (auth.role() = 'authenticated');

create policy "reviews_public_read" on reviews for select using (approved = true);
create policy "reviews_public_insert" on reviews for insert with check (approved = false);
create policy "reviews_admin_all" on reviews for all using (auth.role() = 'authenticated');

-- Storage bucket для фото товаров
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

create policy "products_images_public_read" on storage.objects
  for select using (bucket_id = 'products');

create policy "products_images_auth_upload" on storage.objects
  for insert with check (bucket_id = 'products' and auth.role() = 'authenticated');

create policy "products_images_auth_update" on storage.objects
  for update using (bucket_id = 'products' and auth.role() = 'authenticated');

create policy "products_images_auth_delete" on storage.objects
  for delete using (bucket_id = 'products' and auth.role() = 'authenticated');
