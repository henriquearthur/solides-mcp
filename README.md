# solides-mcp

Servidor [MCP](https://modelcontextprotocol.io) para a API Gestão da Sólides. Com ele, um chat de IA (claude.ai, ChatGPT, Claude Code, Cursor) consulta os dados da sua Empresa na Sólides Gestão: Colaboradores, estrutura, Ocorrências e Feedbacks, Absenteísmo, Avaliações, Profiler, Passaportes e Currículos.

> **Aviso:** este é um projeto independente e **não é afiliado, patrocinado nem endossado pela Sólides**. "Sólides" é marca de seus titulares.

O MCP resolve limitações da API: filtra por nome, Colaborador, tipo e data, pagina as listas (`limit` e `offset`, com `total`), resume cada registro nas listas e aceita datas em ISO (`AAAA-MM-DD`) em vez de `dd/mm/aaaa`.

Há duas formas de usar:

- **stdio**, rodando local com `npx solides-mcp` (Claude Code, Cursor e outros clientes locais);
- **instância remota privada** no Cloudflare Workers, para usar como conector no claude.ai e no ChatGPT. O projeto **não mantém nem divulga nenhuma instância pública**: você sobe a sua.

Vocabulário em [`GLOSSARY.md`](GLOSSARY.md); decisões em [`docs/adr/`](docs/adr).

## Pré-requisito: Token de API

Você precisa de um **Token de API** da sua Empresa, gerado nas configurações da Sólides Gestão. Cada token pertence a uma única Empresa. Trate-o como senha.

## Uso local (stdio)

Requer Node.js 20 ou superior. O token vem da variável de ambiente `SOLIDES_API_TOKEN`; sem ela, o processo falha na inicialização com uma mensagem pedindo o token.

| Variável | Obrigatória | Efeito |
|---|---|---|
| `SOLIDES_API_TOKEN` | sim | Token de API da Empresa |
| `SOLIDES_ALLOW_WRITES` | não | Com `true`, registra as tools de escrita (veja [Escrita](#escrita)). Qualquer outro valor, ou ausente, deixa só leitura |

Claude Code:

```sh
claude mcp add solides --env SOLIDES_API_TOKEN=seu-token -- npx -y solides-mcp
```

Cursor (`~/.cursor/mcp.json` ou `.cursor/mcp.json` no projeto) e qualquer cliente que leia `mcpServers`:

```json
{
  "mcpServers": {
    "solides": {
      "command": "npx",
      "args": ["-y", "solides-mcp"],
      "env": {
        "SOLIDES_API_TOKEN": "seu-token"
      }
    }
  }
}
```

Para liberar a escrita, acrescente `"SOLIDES_ALLOW_WRITES": "true"` em `env`.

## Instância remota própria (Cloudflare Workers)

A instância remota usa OAuth (`workers-oauth-provider`), que é o que o claude.ai e o ChatGPT exigem. Na tela de autorização, cada pessoa cola o **seu** Token de API e escolhe se permite escrita. O token fica só dentro da Autorização, criptografado; quem opera a instância não guarda token próprio e o Worker não registra em log corpos de requisição, de resposta nem tokens.

### Subir a instância

Você precisa de uma conta na Cloudflare e de Node.js 20 ou superior.

1. Clone o repositório e instale as dependências (o `wrangler` vem nelas):

   ```sh
   git clone https://github.com/henriquearthur/solides-mcp.git
   cd solides-mcp
   npm ci
   npx wrangler login
   ```

2. Crie o namespace KV que guarda clientes, Autorizações e tokens do OAuth. O nome do binding, `OAUTH_KV`, é fixo:

   ```sh
   npx wrangler kv namespace create OAUTH_KV
   ```

3. Copie o `id` que o comando imprimir para o `wrangler.toml`, no lugar do placeholder:

   ```toml
   [[kv_namespaces]]
   binding = "OAUTH_KV"
   id = "<id-do-namespace>"
   ```

   O `name` do Worker (`solides-mcp`) define o subdomínio; troque se quiser. O repositório não fixa domínio nem rota.

4. Decida se a instância pode permitir escrita (veja [Escrita](#escrita)). Por padrão ela é **só leitura**. Para permitir que cada usuário escolha liberar a escrita na autorização, troque o valor de `SOLIDES_ALLOW_WRITES` em `[vars]` do `wrangler.toml` (o arquivo traz `"false"`):

   ```toml
   [vars]
   SOLIDES_ALLOW_WRITES = "true"
   ```

5. Faça o deploy:

   ```sh
   npx wrangler deploy
   ```

   O comando imprime a URL do Worker, por exemplo `https://solides-mcp.<seu-subdominio>.workers.dev`. O endpoint MCP é essa URL mais `/mcp`.

O deploy é sempre manual; nenhum workflow publica a instância.

### Plano do Workers

> **Pendente de confirmação.** A medição de CPU da tool `get_occurrences` numa instância real ainda não foi feita. Cada chamada baixa e interpreta cerca de 2,3 MB de JSON (a API devolve todas as Ocorrências de uma vez), e o plano gratuito do Workers limita a CPU a 10 ms por requisição. Uma estimativa local, em Node, com 2,3 MB de Ocorrências sintéticas, mediu de 10 a 28 ms de CPU por chamada. **O plano gratuito provavelmente não basta para `get_occurrences`.** O mantenedor vai confirmar com a medição; até lá, se `get_occurrences` falhar por limite de CPU, use o plano Workers Paid. As demais tools tratam respostas bem menores.

Outro limite do plano gratuito é o de 50 subrequisições por chamada. As tools que percorrem páginas da API (Currículos e Avaliações V3) têm um teto de 40 páginas e avisam na resposta (`incomplete: true`) quando o resultado fica incompleto.

### Conectar no claude.ai

1. Em **Settings > Connectors** (o nome do menu pode variar conforme o plano), adicione um conector personalizado.
2. Informe a URL `https://<sua-instancia>/mcp`.
3. Na tela de autorização que abrir, cole o seu Token de API. O token é validado com uma consulta de leitura antes de concluir. Marque **Permitir escrita** só se quiser (a opção só aparece se a instância permitir escrita).

### Conectar no ChatGPT

1. Em **Settings > Connectors > Advanced**, ative o **modo desenvolvedor** (o nome do menu pode variar conforme o plano).
2. Crie um conector com a URL `https://<sua-instancia>/mcp` e autenticação OAuth.
3. Conclua a autorização colando o Token de API, como acima.

O cliente se registra sozinho (registro dinâmico de clientes). A Autorização dura enquanto você usar o conector ao menos uma vez a cada 30 dias; se o Token de API for revogado na Sólides, as tools respondem "token inválido, reconecte o conector". Para mudar a escolha de escrita, reconecte o conector.

### Segurança e compartilhamento

**A URL da instância não é um segredo forte** (ADR-0001). Quem a conhecer consegue abrir a tela de autorização, mas só conclui com um Token de API válido e só acessa a Empresa dona desse token. **O controle de acesso real é o Token de API.**

Você pode compartilhar a sua instância, inclusive com outras Empresas. Nesse caso, você processa dados pessoais delas: informe isso a quem for usar e mantenha a conta da Cloudflare protegida.

## Tools

Todas as tools de leitura levam `readOnlyHint`. Os nomes são em inglês e as descrições usam os termos da Sólides. As listas aceitam `limit` (padrão 50, máximo 200) e `offset` e devolvem `{ total, limit, offset, items }`. Datas de entrada são sempre `AAAA-MM-DD`.

| Tool | O que faz | Parâmetros principais |
|---|---|---|
| `list_employees` | Lista Colaboradores (resumo) | `name`, `cpf`, `registration`, `department`, `position`, `unity`, `include_dismissed`, `admitted_from`, `admitted_until` |
| `get_employee` | Cadastro completo de um Colaborador | `id` |
| `get_departments` | Departamentos | `id` |
| `get_positions` | Cargos | `id` |
| `get_reference_data` | CBOs, tipos de contrato e motivos de demissão | `kind` (`cbo`, `contract_types`, `dismissal_reasons`), `id`, `search` |
| `get_occurrences` | Ocorrências, incluindo Feedbacks (tipo 10) | `id`, `employee_id`, `type` (1 a 12), `classification` (`positive`, `negative`, `neutral`, `needs_improvement`), `date_from`, `date_until` |
| `get_absences` | Absenteísmos | `id`, `cpf`, `employee_id`, `from`, `until` |
| `get_profiler` | Profiler de todos os Colaboradores ou de um | `id` (do Colaborador) |
| `get_passports` | Passaportes e relatório Profiler | `id`, `report_option` (Simples 1, Regular 2, Estendido 3, Coaching 4, Feedback 5; exige `id`) |
| `get_resumes` | Currículos do banco de talentos | `id`, `from`, `until` |
| `get_evaluations` | Avaliações de desempenho e avançadas | `type` (`performance`, `advanced`), `from`, `to` (obrigatórios) |
| `get_evaluation_cycles` | Ciclos de Avaliação V3 e as avaliações de um ciclo | `cycle_id`, `name`, `cpf` (os dois filtros só valem com `cycle_id`) |
| `create_occurrence` | Registra uma Ocorrência (**escrita**) | `cpf`, `date`, `classification`, `type`, `comment`, `value` |
| `delete_occurrence` | Exclui uma Ocorrência pelo id (**escrita**, `destructiveHint`) | `id` |

A lista completa de parâmetros de cada tool vem do próprio servidor (`tools/list`).

## Escrita

A única escrita suportada é **registrar e excluir Ocorrências** (o que inclui Feedbacks). Ela vem **desligada por padrão**, e as tools `create_occurrence` e `delete_occurrence` nem são registradas enquanto a escrita não estiver permitida. Além disso, o cliente HTTP recusa qualquer método diferente de `GET` antes de chamar a API (ADR-0002).

- **stdio:** `SOLIDES_ALLOW_WRITES=true` no ambiente é o único controle.
- **Instância remota:** duas camadas.
  1. A flag da instalação, `SOLIDES_ALLOW_WRITES`, é o **teto**: desligada (padrão), a opção nem aparece na tela de autorização e a escrita não pode ser ativada. Ligada (`"true"` em `[vars]` do `wrangler.toml`), a opção aparece. A flag vale a cada requisição: desligá-la depois também tira as tools de escrita das Autorizações já criadas.
  2. Em cada Autorização, o usuário decide marcando **Permitir escrita**, que vem desmarcada. A escolha fica gravada na Autorização; para mudá-la, reconecte o conector.

Peça confirmação ao chat antes de registrar ou excluir. Para ter leitura e escrita com regras diferentes, suba duas instâncias ou crie Autorizações distintas.

## Desenvolvimento

```sh
npm ci
npm run typecheck   # núcleo, stdio e Worker
npm test            # testes (Node e runtime do Workers); a API é sempre falsa
npm run build       # compila o pacote npm (núcleo e stdio) em dist/
```

Nenhum teste faz escrita na API real da Sólides.

### Teste de fumaça

Confere se o contrato da API real continua o mesmo. É manual, fora do CI, e faz **somente requisições `GET`**:

```sh
SOLIDES_API_TOKEN=seu-token npm run smoke
```

### Releases

A publicação no npm sai ao criar uma tag `v*` (trusted publishing, sem token guardado). Veja [`docs/release.md`](docs/release.md).

## Licença

[MIT](LICENSE).
