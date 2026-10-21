/** Fixtures de `GET /profiler` e `GET /candidatos` (formas do docs/api/openapi.json: `Profiler` e `Passaporte`). */
export const profilerMaria = {
  id: 1,
  name: "Maria de Fátima Souza",
  email: "maria@example.com.br",
  gender: "Feminino",
  departamentId: 1,
  positionId: 7,
  dateAdmission: "01/03/2018",
  workShift: "Diurno",
  perfil: "EA",
  testDate: "20/12/2017",
};

export const profilerJose = {
  id: 2,
  name: "José Álvares",
  email: "jose@example.com.br",
  gender: "Masculino",
  departamentId: 2,
  positionId: 8,
  dateAdmission: "15/06/2020",
  workShift: "Diurno",
  perfil: "CP",
  testDate: "02/02/2021",
};

export function manyProfilers(count: number) {
  return Array.from({ length: count }, (_, i) => ({ ...profilerMaria, id: i + 1, name: `Pessoa ${i + 1}` }));
}

export const passportAna = {
  id: 10,
  name: "Ana Paula Ribeiro",
  email: "ana@example.com",
  profile: "EC",
  idNumber: "12345678909",
  gender: "Feminino",
  dateOfBirth: "01/07/1987",
  responseDate: "12/07/2017",
  sendDate: "10/07/2017",
  expirationDate: "20/07/2017",
  state: "respondido",
  passportUrl: "http://homol.app.solides.com/passports/f69cf5/pt-BR",
};

export const passportBruno = { ...passportAna, id: 11, name: "Bruno Lima", state: "pendente", profile: "" };
