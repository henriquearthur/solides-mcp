# Publicar uma versão no npm

Publicar o pacote `solides-mcp` exige só criar uma tag. O workflow `.github/workflows/release.yml` roda typecheck e testes, confere se a tag bate com a versão do `package.json` e publica com [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) e provenance. Não existe `NPM_TOKEN` guardado como secret.

A instância remota (Cloudflare Workers) não faz parte deste fluxo: o deploy dela é manual, com `wrangler deploy` (ADR-0001).

## Lançar uma versão

1. Ajuste a versão no `package.json` (por exemplo, `npm version 0.2.0 --no-git-tag-version`) e faça o merge na `main`.
2. Crie e envie a tag, com o prefixo `v` e a mesma versão:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. Acompanhe o workflow **Release** na aba Actions. Se a tag não bater com o `package.json`, o workflow falha antes de publicar; apague a tag, corrija e crie de novo.

## Configuração única no npmjs.com (mantenedor)

Faça uma vez, com a conta que é dona do pacote `solides-mcp` no npm:

1. Garanta que o pacote existe no npm. O npm só permite configurar o trusted publisher de um pacote já publicado, então a primeira versão (`0.1.0`) é publicada à mão, na máquina do mantenedor: `npm login` e `npm publish --access public`. (Não confirmado: se o npm já aceitar configurar o publisher antes da primeira publicação, esse passo manual some.)
2. Em npmjs.com, abra o pacote, depois **Settings** e a seção **Trusted Publisher**. Escolha **GitHub Actions** e preencha:
   - **Organization or user**: `henriquearthur`
   - **Repository**: `solides-mcp`
   - **Workflow filename**: `release.yml` (só o nome do arquivo, com a extensão)
   - **Environment name**: deixe em branco (o workflow não usa environment)
3. Salve. Opcional, mas recomendado: em **Publishing access**, marque "Require two-factor authentication and disallow tokens", já que a publicação passa a ser feita só por OIDC.

Requisitos que o workflow já atende: `permissions: id-token: write` no job de publicação, runner hospedado pelo GitHub, npm CLI >= 11.5.1 (Node 24 mais `npm install -g npm@^11.5.1`) e `repository.url` do `package.json` apontando para este repositório (exigido pelo provenance, que também pede repositório público).

## Conferir o pacote localmente

```sh
npm pack --pack-destination /tmp/solides-mcp-pack
npm exec --package=/tmp/solides-mcp-pack/solides-mcp-0.1.0.tgz -- solides-mcp
```

Sem `SOLIDES_API_TOKEN`, o binário deve sair com erro e a mensagem que pede o token. O teste `test/package.test.ts` garante que o tarball tem o binário e não inclui `src/` nem o código ou as dependências do Worker.
