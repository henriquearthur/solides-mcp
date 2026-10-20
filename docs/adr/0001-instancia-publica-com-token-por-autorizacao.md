# Instância pública no Cloudflare Workers, com o Token de API trazido em cada Autorização

O solides-mcp precisa funcionar em chats remotos, como o claude.ai e o ChatGPT. Esses clientes só se conectam por OAuth e não aceitam um header com token. Por isso, a instância remota usa Cloudflare Workers com `workers-oauth-provider`. Na tela de autorização, cada usuário cola o Token de API da sua Empresa. O token fica guardado só dentro da Autorização, criptografado com o access token. Assim, uma única instância pública (`solides-mcp.hnrq.workers.dev`) atende várias Empresas, e o operador não guarda nenhum token próprio. O mesmo núcleo também é distribuído em modo stdio (`npx solides-mcp`), com o token lido de `SOLIDES_API_TOKEN`.

## Considered Options

- **Token da Empresa como secret da instalação, com login delegado a GitHub ou Google e uma allowlist**: rejeitado. Serve uma única Empresa e exige que cada instalação configure um provedor de identidade.
- **Container Node com servidor OAuth próprio**: rejeitado. Teríamos de implementar o servidor de autorização e o armazenamento que o Workers já oferece prontos.

## Consequences

Na instância pública, o operador processa dados pessoais de colaboradores de outras Empresas e é operador na LGPD. Por isso, o Worker nunca registra em log corpos de requisição ou resposta nem tokens. A tela de autorização e o README avisam que o projeto não é afiliado à Sólides. Cada Autorização tem um limite de 120 chamadas de tool por minuto.
