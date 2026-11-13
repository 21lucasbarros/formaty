# Formaty

Conversor de imagens leve que vive na barra de menus do macOS. Clique no ícone, arraste uma imagem, escolha o formato e baixe — sem abrir apps pesados nem enviar arquivos para sites.

> **Status:** em desenvolvimento ativo. Funcionalidades podem mudar e bugs podem aparecer.

## Funcionalidades

- **App de barra de menus** — abre como um popover logo abaixo do ícone, sem ícone no Dock
- **Arrastar e soltar** ou clique para escolher a imagem
- **Prévia com detalhes** — formato original, dimensões e tamanho do arquivo
- **Comparação de tamanho** após a conversão (ex.: `1.2 MB → 340 KB −72%`)
- **Conversão 100% local**, feita em Rust — nenhuma imagem sai do seu computador
- Visual nativo com efeito de vidro (vibrancy) do macOS

### Formatos suportados

| Saída  | Descrição                  |
| ------ | -------------------------- |
| `PNG`  | Sem perda                  |
| `JPG`  | Comprimido                 |
| `WEBP` | Moderno, boa compressão    |
| `AVIF` | Nova geração, menor tamanho |
| `GIF`  | 256 cores                  |
| `BMP`  | Bitmap sem compressão      |
| `TIFF` | Sem perda                  |
| `ICO`  | Ícone (máx. 256×256)       |

A entrada aceita todos esses formatos, exceto AVIF (a feature `avif` da crate `image` só codifica). SVG ainda não é suportado.

## Como usar

1. Clique no ícone do Formaty na barra de menus
2. Arraste uma imagem para a área de upload (ou clique nela)
3. Escolha o formato de saída na grade
4. Clique em **Converter** e depois em **Baixar**

Pressione `Esc` (com o popover em foco) ou clique no ícone de novo para fechar.

## Tecnologias

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **Backend:** Rust + Tauri v2 (crate [`image`](https://crates.io/crates/image) para a conversão)
- **Build:** Vite + Bun

## Desenvolvimento

### Pré-requisitos

- macOS
- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Pré-requisitos do Tauri](https://tauri.app/start/prerequisites/) (Xcode Command Line Tools)

### Rodando localmente

```bash
# Instalar dependências
bun install

# Rodar em modo de desenvolvimento
bun run tauri dev
```

O app não abre uma janela ao iniciar — procure o ícone na barra de menus.

### Build de produção

```bash
bun run tauri build
```

O `.app` e o `.dmg` ficam em `src-tauri/target/release/bundle/`.

### Estrutura

```
src/                  # Interface (React)
  app.tsx             # Componente principal
  app.css             # Tailwind, tema e animações
src-tauri/
  src/lib.rs          # Comando convert_image, ícone da bandeja e janela
  tauri.conf.json     # Configuração da janela e do bundle
  icons/source/       # SVGs originais do ícone do app e da barra de menus
```

### Ícones

Os ícones são gerados a partir dos SVGs em `src-tauri/icons/source/`:

```bash
# Ícone do app (todos os tamanhos)
bun tauri icon src-tauri/icons/source/app-icon.svg

# Ícone da barra de menus (template monocromático, 22pt @2x)
bun tauri icon src-tauri/icons/source/tray-icon.svg -o /tmp/tray -p 44
cp /tmp/tray/44x44.png src-tauri/icons/tray.png
```

> O primeiro comando também gera as pastas `android/` e `ios/`, que podem ser apagadas.

## Motivação

Criei o Formaty para resolver uma necessidade pessoal: converter imagens rapidamente sem depender de ferramentas online ou apps pesados. O projeto também é uma forma de estudar **Tauri** e **Rust** na construção de aplicações desktop modernas.

## Licença

Projeto pessoal, ainda sem licença definida.
