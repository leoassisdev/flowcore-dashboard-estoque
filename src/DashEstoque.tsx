// DashEstoque · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
// Controle de estoque: busca, filtro por categoria, ordenação, barra de nível com
// estoque mínimo, alerta de ruptura, giro e cobertura em dias, e ação "Repor".
// Pra usar dados reais, troque o array DADOS pela resposta da sua API e salve em onRepor.
// Props: accent (cor de destaque), itens, onRepor, tema ("claro" | "escuro", padrão
// "claro") e onTemaChange (avisa quando o botão sol/lua troca).
// Requisitos: React 18+ e Tailwind CSS 3+. Zero dependências.

import { useMemo, useState, type CSSProperties } from "react";

type Tema = "claro" | "escuro";
type Item = { sku: string; nome: string; categoria: string; estoque: number; minimo: number; maximo: number; vendas30d: number; custo: number };
type Coluna = "nome" | "estoque" | "giro" | "cobertura";

// Paleta de cada tema, aplicada como CSS vars na raiz (não depende do dark: do Tailwind).
const TEMAS: Record<Tema, Record<string, string>> = {
  claro: {
    "--fc-bg": "#F7F8FB", "--fc-surface": "#FFFFFF", "--fc-surface-2": "#F1F4F9",
    "--fc-border": "#E3E8F0", "--fc-border-strong": "#CBD3E1",
    "--fc-text": "#0B1220", "--fc-muted": "#4B5565", "--fc-subtle": "#8A94A6",
    "--fc-pos": "#059669", "--fc-neg": "#E11D48", "--fc-warn": "#D97706",
    "--fc-shadow": "0 1px 2px rgba(16,24,40,.06), 0 12px 32px -16px rgba(16,24,40,.18)",
    "--fc-pop": "#FFFFFF", "--fc-grid": "#EDF0F5",
  },
  escuro: {
    "--fc-bg": "#0B0F17", "--fc-surface": "rgba(255,255,255,0.03)", "--fc-surface-2": "rgba(255,255,255,0.06)",
    "--fc-border": "rgba(255,255,255,0.10)", "--fc-border-strong": "rgba(255,255,255,0.25)",
    "--fc-text": "#FFFFFF", "--fc-muted": "rgba(255,255,255,0.60)", "--fc-subtle": "rgba(255,255,255,0.40)",
    "--fc-pos": "#34D399", "--fc-neg": "#FB7185", "--fc-warn": "#FBBF24",
    "--fc-shadow": "0 24px 48px -24px rgba(0,0,0,.6)",
    "--fc-pop": "#111827", "--fc-grid": "rgba(255,255,255,0.06)",
  },
};
const PALETA = ["var(--accent)", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];
const tinta = (cor: string, pct: number) => `color-mix(in srgb, ${cor} ${pct}%, transparent)`;

// Tema controlado pela prop, mas o botão sol/lua troca por dentro.
function useTema(inicial: Tema, onTemaChange?: (t: Tema) => void) {
  const [tema, setTema] = useState<Tema>(inicial);
  const [prop, setProp] = useState<Tema>(inicial);
  if (prop !== inicial) {
    setProp(inicial);
    setTema(inicial);
  }
  const alternar = () => {
    const novo: Tema = tema === "claro" ? "escuro" : "claro";
    setTema(novo);
    onTemaChange?.(novo);
  };
  return [tema, alternar] as const;
}

function BotaoTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] transition-colors hover:bg-[var(--fc-surface-2)] hover:text-[var(--fc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {escuro ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}

const DADOS: Item[] = [
  { sku: "CBL-0412", nome: "Cabo de rede Cat6 305m", categoria: "Infraestrutura", estoque: 18, minimo: 25, maximo: 120, vendas30d: 64, custo: 689 },
  { sku: "SWT-2210", nome: "Switch gerenciável 24 portas", categoria: "Infraestrutura", estoque: 42, minimo: 15, maximo: 60, vendas30d: 21, custo: 2_340 },
  { sku: "NBK-1450", nome: "Notebook corporativo i7 16GB", categoria: "Hardware", estoque: 7, minimo: 10, maximo: 40, vendas30d: 26, custo: 5_890 },
  { sku: "MON-2700", nome: 'Monitor 27" QHD', categoria: "Hardware", estoque: 33, minimo: 12, maximo: 50, vendas30d: 18, custo: 1_720 },
  { sku: "TEC-0081", nome: "Teclado sem fio ABNT2", categoria: "Periféricos", estoque: 156, minimo: 40, maximo: 200, vendas30d: 92, custo: 149 },
  { sku: "MOU-0093", nome: "Mouse ergonômico", categoria: "Periféricos", estoque: 22, minimo: 40, maximo: 180, vendas30d: 88, custo: 119 },
  { sku: "NBR-5000", nome: "Nobreak 3kVA senoidal", categoria: "Energia", estoque: 9, minimo: 6, maximo: 25, vendas30d: 5, custo: 3_480 },
  { sku: "HDS-0300", nome: "Headset com cancelamento de ruído", categoria: "Periféricos", estoque: 61, minimo: 30, maximo: 120, vendas30d: 47, custo: 389 },
  { sku: "SSD-1000", nome: "SSD NVMe 1TB", categoria: "Hardware", estoque: 4, minimo: 20, maximo: 90, vendas30d: 58, custo: 459 },
  { sku: "RCK-4200", nome: "Rack de parede 12U", categoria: "Infraestrutura", estoque: 14, minimo: 5, maximo: 20, vendas30d: 3, custo: 1_090 },
];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const giro = (i: Item) => (i.vendas30d * 12) / Math.max(1, (i.estoque + i.maximo) / 2);
const cobertura = (i: Item) => Math.round(i.estoque / (i.vendas30d / 30 || 1));


const ICONES_KPI = [
  "M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H6",
  "M4 7l8-4 8 4v10l-8 4-8-4V7zm0 0l8 4 8-4M12 11v10",
  "M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M18 3v4h-4M6 21v-4h4",
  "M12 3l10 18H2L12 3zM12 10v4M12 17.5h.01",
];

type Props = { accent?: string; itens?: Item[]; onRepor?: (sku: string, quantidade: number) => void; tema?: Tema; onTemaChange?: (t: Tema) => void };

export default function DashEstoque({ accent = "#0057FF", itens: inicial = DADOS, onRepor, tema = "claro", onTemaChange }: Props) {
  const [modo, alternarTema] = useTema(tema, onTemaChange);
  const [itens, setItens] = useState<Item[]>(inicial);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("Todas");
  const [soAlerta, setSoAlerta] = useState(false);
  const [ordem, setOrdem] = useState<{ col: Coluna; dir: 1 | -1 }>({ col: "cobertura", dir: 1 });
  const [aviso, setAviso] = useState("");

  const categorias = ["Todas", ...Array.from(new Set(itens.map((i) => i.categoria)))];
  const corCat = (c: string) => PALETA[Math.max(0, categorias.indexOf(c) - 1) % PALETA.length];
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const val = (i: Item) => (ordem.col === "nome" ? i.nome : ordem.col === "estoque" ? i.estoque / i.maximo : ordem.col === "giro" ? giro(i) : cobertura(i));
    return itens
      .filter((i) => (cat === "Todas" || i.categoria === cat) && (!soAlerta || i.estoque < i.minimo) && (!q || `${i.nome} ${i.sku}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : x - (y as number)) * ordem.dir;
      });
  }, [itens, busca, cat, soAlerta, ordem]);

  const alertas = itens.filter((i) => i.estoque < i.minimo);
  const valorTotal = itens.reduce((s, i) => s + i.estoque * i.custo, 0);
  const giroMedio = itens.reduce((s, i) => s + giro(i), 0) / itens.length;

  const repor = (sku: string) => {
    const item = itens.find((i) => i.sku === sku);
    if (!item) return;
    const qtd = item.maximo - item.estoque;
    setItens((l) => l.map((i) => (i.sku === sku ? { ...i, estoque: i.maximo } : i)));
    setAviso(`Pedido de compra gerado: ${qtd} un. de ${item.nome}.`);
    onRepor?.(sku, qtd);
  };

  const ordenar = (col: Coluna) => setOrdem((o) => ({ col, dir: o.col === col ? (o.dir === 1 ? -1 : 1) : 1 }));
  // Função de render (não componente) pra o botão não remontar e perder o foco ao ordenar.
  const th = (col: Coluna, children: string, className = "") => (
    <th scope="col" aria-sort={ordem.col === col ? (ordem.dir === 1 ? "ascending" : "descending") : "none"} className={`px-4 py-2.5 font-medium ${className}`}>
      <button type="button" onClick={() => ordenar(col)} className="inline-flex items-center gap-1 rounded hover:text-[var(--fc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
        {children}
        <span aria-hidden className={ordem.col === col ? "text-[var(--accent)]" : "text-[var(--fc-subtle)] opacity-60"}>{ordem.col === col && ordem.dir === -1 ? "↓" : "↑"}</span>
      </button>
    </th>
  );

  const nivel = (i: Item) => {
    const baixo = i.estoque < i.minimo;
    return (
      <>
        <div className="relative h-2 rounded-full bg-[var(--fc-surface-2)]" role="img" aria-label={`${i.estoque} de ${i.maximo} unidades, mínimo ${i.minimo}`}>
          <div className="h-full rounded-full motion-safe:transition-all motion-safe:duration-500" style={{ width: `${Math.min(100, (i.estoque / i.maximo) * 100)}%`, background: baixo ? "var(--fc-neg)" : "var(--accent)" }} />
          <span className="absolute -top-1 h-4 w-0.5 rounded bg-[var(--fc-warn)]" style={{ left: `${(i.minimo / i.maximo) * 100}%` }} title={`Mínimo: ${i.minimo}`} />
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-[var(--fc-subtle)]">
          <span className={baixo ? "font-medium text-[var(--fc-neg)]" : "text-[var(--fc-muted)]"}>{i.estoque}</span> / {i.maximo} un. · mín. {i.minimo}
        </p>
      </>
    );
  };
  const botaoRepor = (i: Item) => (
    <button
      type="button"
      onClick={() => repor(i.sku)}
      disabled={i.estoque >= i.maximo}
      aria-label={`Repor ${i.nome}`}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-default disabled:opacity-40 ${i.estoque < i.minimo ? "bg-[var(--accent)] text-white shadow-[0_6px_16px_-8px_var(--accent)] hover:brightness-110" : "border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] hover:bg-[var(--fc-surface-2)] hover:text-[var(--fc-text)]"}`}
    >
      {i.estoque >= i.maximo ? "Cheio" : "Repor"}
    </button>
  );
  const corCobertura = (dias: number) => (dias < 10 ? "font-medium text-[var(--fc-neg)]" : dias < 20 ? "font-medium text-[var(--fc-warn)]" : "text-[var(--fc-muted)]");
  const categoria = (c: string) => (
    <span className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: tinta(corCat(c), 12), color: corCat(c) }}>
      {c}
    </span>
  );
  const card = "rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 shadow-[var(--fc-shadow)]";
  const chip = (i: number, cor = PALETA[i % PALETA.length]) => (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: tinta(cor, 12), color: cor }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICONES_KPI[i]} />
      </svg>
    </span>
  );
  const campo = "h-9 rounded-lg border border-[var(--fc-border)] text-sm text-[var(--fc-text)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]";

  return (
    <div style={{ ...TEMAS[modo], colorScheme: modo === "claro" ? "light" : "dark", "--accent": accent } as CSSProperties} data-tema={modo} className="min-h-full bg-[var(--fc-bg)] p-4 text-[var(--fc-text)] sm:p-6 lg:p-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--fc-subtle)]">Suprimentos · Centro de distribuição Campinas</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Estoque</h1>
        </div>
        <BotaoTema tema={modo} onClick={alternarTema} />
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={card}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--fc-muted)]">Valor em estoque</p>
            {chip(0)}
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums sm:text-2xl">{brl(valorTotal)}</p>
        </div>
        <div className={card}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--fc-muted)]">SKUs ativos</p>
            {chip(1)}
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums sm:text-2xl">{itens.length}</p>
        </div>
        <div className={card}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--fc-muted)]">Giro médio anual</p>
            {chip(2)}
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums sm:text-2xl">{giroMedio.toFixed(1).replace(".", ",")}x</p>
        </div>
        <div
          className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 shadow-[var(--fc-shadow)]"
          style={alertas.length ? { borderColor: tinta("var(--fc-neg)", 30), background: tinta("var(--fc-neg)", 6) } : undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-[var(--fc-muted)]">Abaixo do mínimo</p>
            {chip(3, alertas.length ? "var(--fc-neg)" : "var(--fc-pos)")}
          </div>
          <p className={`mt-1.5 text-lg font-semibold tabular-nums sm:text-2xl ${alertas.length ? "text-[var(--fc-neg)]" : "text-[var(--fc-pos)]"}`} data-alertas>
            {alertas.length}
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] shadow-[var(--fc-shadow)]">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
          <label className="relative flex-1 sm:min-w-[14rem]">
            <span className="sr-only">Buscar produto ou SKU</span>
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fc-subtle)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto ou SKU"
              className={`w-full bg-[var(--fc-surface)] pl-9 pr-3 placeholder:text-[var(--fc-subtle)] ${campo}`}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--fc-muted)]">
            <span className="sr-only">Categoria</span>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className={`w-full bg-[var(--fc-pop)] px-3 sm:w-auto ${campo}`}>
              {categorias.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={soAlerta}
            onClick={() => setSoAlerta((v) => !v)}
            style={soAlerta ? { borderColor: tinta("var(--fc-neg)", 35), background: tinta("var(--fc-neg)", 10) } : undefined}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${soAlerta ? "text-[var(--fc-neg)]" : "border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] hover:bg-[var(--fc-surface-2)] hover:text-[var(--fc-text)]"}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--fc-neg)]" />
            Só alertas
          </button>
          <div className="flex gap-2 lg:hidden">
            <label className="flex-1">
              <span className="sr-only">Ordenar por</span>
              <select
                value={ordem.col}
                onChange={(e) => setOrdem((o) => ({ col: e.target.value as Coluna, dir: o.dir }))}
                className={`w-full bg-[var(--fc-pop)] px-3 ${campo}`}
              >
                <option value="cobertura">Ordenar: cobertura</option>
                <option value="nome">Ordenar: produto</option>
                <option value="estoque">Ordenar: nível</option>
                <option value="giro">Ordenar: giro</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setOrdem((o) => ({ ...o, dir: o.dir === 1 ? -1 : 1 }))}
              aria-label={ordem.dir === 1 ? "Ordem crescente (inverter)" : "Ordem decrescente (inverter)"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] text-sm text-[var(--fc-muted)] hover:bg-[var(--fc-surface-2)] hover:text-[var(--fc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <span aria-hidden>{ordem.dir === 1 ? "↑" : "↓"}</span>
            </button>
          </div>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={`mx-4 mb-3 rounded-lg border px-3 py-2 text-xs font-medium text-[var(--fc-pos)] sm:mx-6 ${aviso ? "" : "hidden"}`}
          style={{ borderColor: tinta("var(--fc-pos)", 25), background: tinta("var(--fc-pos)", 8) }}
        >
          {aviso}
        </p>

        <ul className="lg:hidden">
          {lista.map((i) => {
            const dias = cobertura(i);
            return (
              <li key={i.sku} className="border-t border-[var(--fc-border)] px-4 py-3 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{i.nome}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fc-subtle)]">
                      <span className="font-mono">{i.sku}</span>
                      {categoria(i.categoria)}
                    </p>
                  </div>
                  <div className="shrink-0">{botaoRepor(i)}</div>
                </div>
                <div className="mt-3">{nivel(i)}</div>
                <div className="mt-1 flex justify-between text-xs tabular-nums">
                  <span className="text-[var(--fc-subtle)]">
                    Giro <span className="text-[var(--fc-muted)]">{giro(i).toFixed(1).replace(".", ",")}x</span>
                  </span>
                  <span className="text-[var(--fc-subtle)]">
                    Cobertura <span className={corCobertura(dias)}>{dias} dias</span>
                  </span>
                </div>
              </li>
            );
          })}
          {lista.length === 0 && <li className="border-t border-[var(--fc-border)] px-6 py-10 text-center text-xs text-[var(--fc-subtle)]">Nenhum item encontrado.</li>}
        </ul>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-[var(--fc-subtle)]">
              <tr className="border-y border-[var(--fc-border)]">
                {th("nome", "Produto", "sm:pl-6")}
                <th scope="col" className="px-4 py-2.5 font-medium">Categoria</th>
                {th("estoque", "Nível", "w-56")}
                {th("giro", "Giro", "text-right")}
                {th("cobertura", "Cobertura", "text-right")}
                <th scope="col" className="px-4 py-2.5 text-right font-medium sm:pr-6"><span className="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => {
                const dias = cobertura(i);
                return (
                  <tr key={i.sku} className="border-b border-[var(--fc-border)] last:border-0 hover:bg-[var(--fc-surface-2)]">
                    <th scope="row" className="px-4 py-3 font-normal sm:pl-6">
                      <p className="font-medium">{i.nome}</p>
                      <p className="font-mono text-[11px] text-[var(--fc-subtle)]">{i.sku}</p>
                    </th>
                    <td className="px-4 py-3">{categoria(i.categoria)}</td>
                    <td className="px-4 py-3">{nivel(i)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--fc-muted)]">{giro(i).toFixed(1).replace(".", ",")}x</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${corCobertura(dias)}`}>{dias} dias</td>
                    <td className="px-4 py-3 text-right sm:pr-6">{botaoRepor(i)}</td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-xs text-[var(--fc-subtle)]">Nenhum item encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-6 flex flex-col gap-2 text-[11px] text-[var(--fc-subtle)] sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-[var(--fc-warn)]" />Marcador amarelo: estoque mínimo</p>
        <a href="https://flowcoresolucoes.com.br/codigos" target="_blank" rel="noopener" className="text-[11px] text-[var(--fc-subtle)] transition-colors hover:text-[var(--fc-text)]">
          Criado por FlowCore Soluções LTDA
        </a>
      </footer>
    </div>
  );
}
