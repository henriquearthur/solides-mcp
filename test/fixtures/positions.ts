/** Fixtures de Cargos e dados de referência (forma conforme docs/api/openapi.json). */
export const positions = [
  {
    id: 1,
    name: "Analista de Sistemas",
    minimumWage: 4500,
    briefDescription: "Desenvolve e mantém sistemas internos.",
    activities: "Programar, revisar código e dar suporte.",
  },
  {
    id: 2,
    name: "Gerente de RH",
    minimumWage: 9000,
    briefDescription: "Lidera a área de Recursos Humanos.",
    activities: "Gerir pessoas e processos de RH.",
  },
];

export const cbos = [
  { id: 1, codigo: "212405", descricao: "Analista de desenvolvimento de sistemas" },
  { id: 2, codigo: "142320", descricao: "Gerente de recursos humanos" },
  { id: 3, codigo: "764305", descricao: "Acabador de calçados" },
];

export const contractTypes = [{ tipoContrato: "CLT" }, { tipoContrato: "Estágio" }, { tipoContrato: "PJ" }];

export const dismissalReasons = [
  { id: 1, name: "Falta" },
  { id: 2, name: "Pedido de demissão" },
];
