# Sólides Gestão

Linguagem do módulo de gestão de pessoas da Sólides (colaboradores, estrutura organizacional, ocorrências e avaliações), exposta pela API Gestão e pelo solides-mcp.

## Acesso

**Empresa**:
Cliente da Sólides cujos dados são acessados; cada Token de API pertence a exatamente uma Empresa.
_Avoid_: tenant, conta, organização

**Token de API**:
Credencial gerada nas configurações da Sólides Gestão que dá acesso à API em nome de uma Empresa.
_Avoid_: chave, API key

**Autorização**:
Vínculo entre um cliente de chat e um Token de API, feito no conector, que também registra se a escrita foi permitida.
_Avoid_: grant, sessão, conexão

## Pessoas

**Colaborador**:
Pessoa vinculada à empresa, ativa ou demitida, identificada pelo CPF e pela matrícula.
_Avoid_: funcionário, employee (fora do código)

**Matrícula**:
Identificador do colaborador definido pela empresa, distinto do id interno da Sólides.
_Avoid_: registro

## Estrutura

**Departamento**:
Área da empresa à qual o colaborador pertence.
_Avoid_: setor, área

**Cargo**:
Função ocupada pelo colaborador, opcionalmente associada a um CBO.
_Avoid_: posição, função

**Unidade**:
Estabelecimento ou filial onde o colaborador está lotado.
_Avoid_: filial, local

## Acompanhamento

**Ocorrência**:
Registro datado sobre um colaborador, com um tipo (Falta/Ausência, Atraso, Promoção, Advertência, Feedback, entre outros) e uma classificação positiva ou negativa.
_Avoid_: incidente, evento

**Feedback**:
Ocorrência do tipo Feedback; não é um recurso próprio.

**Absenteísmo**:
Registro de ausência de um colaborador num momento, podendo ter origem no Tangerino.
_Avoid_: falta (quando se refere ao registro)

**Avaliação de desempenho**:
Avaliação de um colaborador por um avaliador num ciclo, com critérios e comentários; consultada por intervalo de datas.

## Perfil comportamental

**Profiler**:
Resultado do teste comportamental de uma pessoa.
_Avoid_: DISC, perfil (sozinho)

**Passaporte**:
Convite para uma pessoa fazer o teste Profiler.
_Avoid_: candidato (apesar do caminho `/candidatos`)

**Currículo**:
Candidato no banco de talentos da empresa.
_Avoid_: candidato
