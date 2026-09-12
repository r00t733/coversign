# coversign

Plataforma para comparar portadas de un mismo libro publicadas por distintas
editoriales y en distintos países del mundo.

## Características

- **Página principal**: cuadrícula minimalista con todas las portadas
  (una por libro, la edición destacada).
- **Buscador**: por título (original o de edición) o por autor.
- **Vista de detalle**: al hacer clic en una portada se abre una ventana con
  la portada principal, el título de esa edición, el título original del
  libro, autor, editorial, país, idioma, año, características de diseño
  editorial/de portada, descripción y un enlace para ver o leer esa edición.
- **Comparación entre ediciones**: debajo de la información aparecen
  miniaturas de las demás ediciones del mismo libro; al hacer clic en una
  miniatura, esa edición pasa a ser la portada principal y toda la
  información (título de la edición, editorial, país, idioma, año,
  descripción, enlace) se actualiza, manteniendo siempre visible el título
  original del libro.
- **Aportes manuales**: el botón "+ Aportar portada" permite agregar una
  nueva edición a un libro existente o registrar un libro nuevo con su
  primera portada (título, editorial, país, idioma, año, imagen de
  portada, descripción, notas de diseño, enlace de lectura/visualización
  y sitio de referencia usado como fuente).

## Arquitectura

- **Backend**: Node.js + Express (`server/`). Expone una API REST simple
  sobre un archivo JSON (`data/db.json`) que actúa como base de datos.
- **Frontend**: HTML/CSS/JS sin frameworks (`public/`), tipografía
  monoespaciada (Consolas), fondo blanco, diseño minimalista.

### API

| Método | Ruta                        | Descripción                                    |
| ------ | --------------------------- | ----------------------------------------------- |
| GET    | `/api/books`                 | Lista todos los libros (edición destacada)      |
| GET    | `/api/search?q=texto`         | Busca por título, autor, editorial o país       |
| GET    | `/api/books/:id`              | Detalle de un libro con todas sus ediciones     |
| POST   | `/api/books`                  | Crea un libro nuevo con su primera edición      |
| POST   | `/api/books/:id/editions`     | Agrega una edición a un libro existente         |

Cada edición puede incluir `sourceLink` (dónde ver/leer esa edición) y
`sourceSite` (sitio web usado como referencia/fuente de los datos), lo que
permite enlazar el catálogo con distintas páginas base (p. ej. Open
Library) además de los aportes manuales.

## Uso

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`.
