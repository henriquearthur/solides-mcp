# Instância remota privada no Cloudflare Workers, com o Token de API trazido em cada Autorização

O solides-mcp precisa funcionar em chats remotos, como o claude.ai e o ChatGPT. Esses clientes só se conectam por OAuth e não aceitam um header com token. Por isso, a instância remota usa Cloudflare Workers com `workers-oauth-provider`. Na tela de autorização, cada usuário cola o Token de API da sua Empresa. O token fica guardado só dentro da Autorização, criptografado com o access token. Assim, quem sobe uma instância não guarda nenhum token próprio e pode compartilhá-la com outras pessoas, mesmo de outras Empresas.

O projeto não mantém nem divulga uma instância pública. Cada pessoa sobe a sua com `wrangler deploy` e compartilha a URL só com quem quiser. O mesmo núcleo também é distribuído em modo stdio (`npx solides-mcp`), com o token lido de `SOLIDES_API_TOKEN`.

## Considered Options

- **Instância pública mantida pelo projeto**: rejeitada. Obrigaria o mantenedor a operar dados pessoais de Empresas desconhecidas, a controlar abuso com rate limit e a manter a instância no ar.
- **Token da Empresa como secret da instalação, com login delegado a GitHub ou Google e uma allowlist**: rejeitado. Serve uma única Empresa e exige que cada instalação configure um provedor de identidade.
- **Container Node com servidor OAuth próprio**: rejeitado. Teríamos de implementar o servidor de autorização e o armazenamento que o Workers já oferece prontos.

## Consequences

A URL de uma instância não é segredo forte: quem a conhecer consegue concluir uma Autorização, mas só com um Token de API válido, e acessa apenas a Empresa desse token. O controle de acesso real é o Token de API.

Quem compartilha sua instância com outras Empresas processa dados pessoais delas. Por isso, o Worker nunca registra em log corpos de requisição ou resposta nem tokens. O README avisa que o projeto não é afiliado à Sólides.
