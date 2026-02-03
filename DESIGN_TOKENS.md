# Design Tokens - FreshFlow

## Guia de Substituição de Cores Hardcoded

### Tokens de Background
```
bg-white          → bg-background  (fundo principal)
bg-white          → bg-card        (fundo de cards)
bg-gray-50        → bg-muted       (fundo suave)
bg-gray-100       → bg-secondary   (fundo secundário)
```

### Tokens de Texto
```
text-gray-900     → text-foreground      (texto principal)
text-gray-700     → text-card-foreground (texto em cards)
text-gray-600     → text-muted-foreground (texto secundário)
text-gray-500     → text-muted-foreground (texto terciário)
```

### Tokens de Borda
```
border-gray-200   → border-border  (borda padrão)
border-gray-300   → border-border  (borda com destaque)
```

### Tokens de Hover/Focus
```
hover:bg-gray-50  → hover:bg-accent/10
hover:bg-gray-100 → hover:bg-accent/20
hover:bg-gray-200 → hover:bg-accent/30
focus:ring-blue-500 → focus:ring-ring
```

### Tokens de Status
```
bg-green-50       → bg-success/10
text-green-700    → text-success
bg-red-50         → bg-destructive/10
text-red-600      → text-destructive
bg-yellow-50      → bg-warning/10
text-yellow-700   → text-warning
```

### Tokens de Botões Primários
```
bg-green-600      → bg-primary
text-white        → text-primary-foreground
hover:bg-green-700 → hover:bg-primary-hover
```

### Tokens de Botões Secundários
```
bg-blue-50        → bg-secondary
text-blue-700     → text-secondary-foreground
```

## Componentes Especiais

### Navbar
```
bg-white          → bg-card
border-gray-200   → border-border
text-gray-700     → text-foreground
hover:bg-gray-100 → hover:bg-accent/10
```

### Dropdown/Popover
```
bg-white          → bg-popover
text-gray-900     → text-popover-foreground
hover:bg-gray-100 → hover:bg-accent/80
```

### Tables
```
bg-gray-50        → bg-muted (header)
bg-white          → bg-card (body)
hover:bg-gray-50  → hover:bg-accent/5
divide-gray-200   → divide-border
```

### Forms
```
bg-gray-50        → bg-input
border-gray-300   → border-input
focus:border-blue-500 → focus:border-ring
```

## Exemplos de Uso

### Card Simples
```tsx
// ❌ Antes
<div className="bg-white border border-gray-200 rounded-lg shadow">
  <h2 className="text-gray-900">Título</h2>
  <p className="text-gray-600">Descrição</p>
</div>

// ✅ Depois
<div className="bg-card border border-border rounded-lg shadow">
  <h2 className="text-card-foreground">Título</h2>
  <p className="text-muted-foreground">Descrição</p>
</div>
```

### Botão com Hover
```tsx
// ❌ Antes
<button className="bg-white hover:bg-gray-100 text-gray-700">
  Clique
</button>

// ✅ Depois
<button className="bg-card hover:bg-accent/10 text-card-foreground">
  Clique
</button>
```

### Tabela
```tsx
// ❌ Antes
<table className="bg-white divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr className="text-gray-500">...</tr>
  </thead>
  <tbody className="bg-white">
    <tr className="hover:bg-gray-50">...</tr>
  </tbody>
</table>

// ✅ Depois
<table className="bg-card divide-y divide-border">
  <thead className="bg-muted">
    <tr className="text-muted-foreground">...</tr>
  </thead>
  <tbody className="bg-card">
    <tr className="hover:bg-accent/5">...</tr>
  </tbody>
</table>
```
