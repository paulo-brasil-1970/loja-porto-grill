# Deploy no WordPress (subpasta /cardapio/)

## 1. Preencher variáveis de ambiente

Edite `.env.local`:
```
VITE_SUPABASE_URL=https://njmndhmoflluzelwkqqp.supabase.co
VITE_SUPABASE_ANON_KEY=<sua anon key — disponível em: Supabase > Settings > API>
```

## 2. Instalar dependências e fazer o build

```
npm install
npm run build
```
O build gera a pasta `dist/` com todos os assets.

## 3. Enviar para o servidor

Via FTP/SFTP ou painel da Hostinger, copie o **conteúdo** da pasta `dist/`
para uma nova pasta `cardapio/` na raiz do WordPress:

```
public_html/
  cardapio/
    index.html
    assets/
      index-XXXX.js
      index-XXXX.css
```

## 4. Criar .htaccess na pasta /cardapio/

Crie o arquivo `public_html/cardapio/.htaccess` com o conteúdo abaixo.
Ele garante que rotas internas do React (futuros /cardapio/checkout, etc.)
sejam sempre servidas pelo index.html:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [QSA,L]
```

## 5. Testar

Acesse: https://portogrill.com.br/cardapio/

## 6. Atualizar RLS do Supabase (leitura pública do cardápio)

No Supabase SQL Editor, execute:

```sql
-- Permite leitura pública de categorias e produtos (cardápio visível sem login)
CREATE POLICY "cardapio_publico_categorias"
  ON loja.categorias FOR SELECT USING (ativo = true);

CREATE POLICY "cardapio_publico_produtos"
  ON loja.produtos FOR SELECT USING (true);

CREATE POLICY "cardapio_publico_grupos"
  ON loja.grupos_complemento FOR SELECT USING (true);

CREATE POLICY "cardapio_publico_itens"
  ON loja.itens_complemento FOR SELECT USING (disponivel = true);
```
