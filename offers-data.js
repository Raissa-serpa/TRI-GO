window.OFFERS = [
]
// util para formatação BRL
window.formatBRL = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
