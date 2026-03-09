# Formaty

Conversor de formatos de imagem simples e rápido para macOS.

## tatus do Projeto

Este projeto está **em desenvolvimento ativo**. Funcionalidades podem mudar e bugs podem aparecer.

## Motivação

Criei o Formaty para suprir uma necessidade pessoal de converter imagens rapidamente entre diferentes formatos sem precisar abrir aplicativos pesados ou usar ferramentas online. Além disso, o projeto serve como uma forma de estudar e aprender **Tauri** e **Rust**, explorando a construção de aplicações desktop modernas.

## Sobre o Projeto

Formaty é uma ferramenta desktop que permite:

- Converter imagens entre diversos formatos (PNG, JPG, WEBP, AVIF, GIF, BMP, TIFF, ICO, SVG)
- Interface drag-and-drop intuitiva
- Preview da imagem antes da conversão
- Download rápido do arquivo convertido
- Interface minimalista e sempre visível (menubar-style app)

## Tecnologias

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri v2
- **Build**: Vite + Bun

## Como Executar

### Pré-requisitos

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/)
- [Tauri CLI](https://tauri.app/)

### Desenvolvimento

```bash
# Instalar dependências
bun install

# Executar em modo de desenvolvimento
bun run tauri dev
```

### Build

```bash
bun run tauri build
```

## 📝 Licença

Projeto pessoal em desenvolvimento.
