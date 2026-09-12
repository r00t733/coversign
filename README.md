# coversign

Plataforma para comparar portadas de un mismo libro publicadas por distintas
editoriales y en distintos países del mundo.

## Características

- **Página principal**: mosaico de portadas (estilo Are.na / Cosmos) — solo
  imágenes, sin texto encima. La información aparece únicamente al hacer
  clic en una portada.
- **Buscador**: por título (original o de edición) o por autor.
- **Vista de detalle**: al hacer clic en una portada se abre una ventana con
  la portada principal, el título de esa edición, el título original del
  libro, autor, editorial, país, idioma, año, la sinopsis del libro (de qué
  trata) y, solo cuando están disponibles para esa edición, sus
  características de diseño editorial y de diseño de portada/ilustración,
  además de un enlace para ver o leer esa edición.
- **Comparación entre ediciones**: debajo de la información aparecen
  miniaturas de las demás ediciones del mismo libro; al hacer clic en una
  miniatura, esa edición pasa a ser la portada principal y su información
  (editorial, país, idioma, año, diseño, enlace) se actualiza, manteniendo
  siempre visible el título original y la sinopsis del libro.
- **Aportes manuales**: el botón "+ Aportar portada" permite agregar una
  nueva edición a un libro existente o registrar un libro nuevo con su
  primera portada. La imagen se puede **subir directamente como archivo**
  (JPG, PNG, WEBP o GIF) o, alternativamente, enlazar por URL. Toda la
  carga de datos y la colaboración son manuales.
- **Las ediciones ya aportadas son inmutables**: no existe forma de editar
  la información de una edición ya publicada ni de reemplazar su imagen.
  Si un aporte nuevo describe la misma editorial, país y año que una
  edición ya registrada, la API lo rechaza (409) en vez de sobrescribirla;
  cualquier corrección debe cargarse como una edición nueva y distinguible
  (por ejemplo, con otro año o una nota que la diferencie).

## Arquitectura: un vault de Obsidian como base de datos

En lugar de una base de datos separada, coversign lee y escribe directamente
sobre una carpeta con la misma estructura que un **vault de Obsidian**, para
que todo el contenido se pueda explorar y editar también desde Obsidian:

```
coversign/
  Biblioteca/          # una nota .md por LIBRO (obra): título original,
                        # autor, idioma original y la sinopsis en el cuerpo
  Archivero/
    <libro>/            # una nota .md por EDICIÓN de ese libro: editorial,
                          # país, idioma, año, diseño (si se conoce) y fuente
  Covers/
    <libro>/             # imágenes de portada subidas manualmente
  server/                # backend Express que sirve la API sobre el vault
  public/                # frontend (HTML/CSS/JS sin frameworks)
```

Cada nota de `Biblioteca/` tiene frontmatter (`title`, `author`,
`originalLanguage`) y el cuerpo de la nota es la sinopsis del libro. Cada
nota de `Archivero/<libro>/` describe una edición concreta (`publisher`,
`country`, `language`, `year`, `cover`, `editorialDesign`, `coverArt`,
`sourceLink`, `sourceSite`) y enlaza a su libro mediante el campo `book`.
`editorialDesign` y `coverArt` son opcionales: solo se muestran en la
interfaz cuando la nota los incluye.

Para trabajar con el catálogo desde Obsidian, abre la carpeta `coversign/`
como vault: cada libro y cada edición es una nota editable, y las imágenes
de `Covers/` se pueden insertar en cualquier nota con `![[Covers/...]]`.

### API

| Método | Ruta                        | Descripción                                    |
| ------ | --------------------------- | ----------------------------------------------- |
| GET    | `/api/books`                 | Lista todos los libros (edición destacada)      |
| GET    | `/api/search?q=texto`         | Busca por título, autor, editorial o país       |
| GET    | `/api/books/:id`              | Detalle de un libro con todas sus ediciones     |
| POST   | `/api/books`                  | Crea un libro nuevo con su primera edición      |
| POST   | `/api/books/:id/editions`     | Agrega una edición a un libro existente         |

Los dos `POST` aceptan `multipart/form-data`: si se envía el campo de
archivo `coverFile`, la imagen se guarda en `Covers/<libro>/`; si en cambio
se envía `coverUrl`, se enlaza esa URL externa sin descargarla.

## Uso

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`.
