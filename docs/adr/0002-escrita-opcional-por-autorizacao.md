# Escrita opcional em cada Autorização, com a flag da instalação como teto

O MCP expõe escrita apenas para registrar e excluir Ocorrências. Ela fica desligada por padrão. Na instância remota, o usuário só a liga marcando "Permitir escrita" na tela de autorização. A escolha fica gravada na Autorização e, sem ela, as tools de escrita nem são registradas. A flag `SOLIDES_ALLOW_WRITES` funciona como teto da instalação: desligada, a caixa não aparece. No modo stdio, ela é o único controle. O cliente HTTP recusa qualquer método diferente de GET quando a escrita não foi permitida. As tools levam as anotações `readOnlyHint` e `destructiveHint`.

## Consequences

Durante o desenvolvimento e os testes, é proibido escrever na API real. Os testes de escrita usam HTTP mockado, e o teste contra a API real só faz GET. Quem precisar de leitura e escrita com regras diferentes sobe duas instâncias, ou cria Autorizações distintas.
