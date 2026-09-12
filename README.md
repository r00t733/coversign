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
  libro, autor, editorial, país, idioma, año y, solo cuando están
  disponibles para esa edición, el diseño editorial y el nombre de quien
  diseñó o ilustró la portada (con enlace a su portafolio si se cargó uno).
  Debajo, en texto más chico, la sinopsis del libro y un enlace para ver o
  leer esa edición. El foco es la ficha de diseño, no la reseña literaria.
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
- **Autocompletar por ISBN**: en el formulario de aporte, buscar un ISBN
  consulta la API pública de Google Books y precarga título, autor,
  editorial, año, idioma, portada y sinopsis; el país y los datos de
  diseño quedan para completar a mano. Necesita conexión a internet.
- **Instalable como app (PWA)**: desde el navegador (celular o escritorio)
  se puede "agregar a la pantalla de inicio". Una vez instalada, navegar
  el catálogo y las portadas ya visitadas funciona sin conexión; aportar
  una portada nueva o autocompletar por ISBN sigue necesitando internet.

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
  public/                # frontend (HTML/CSS/JS sin frameworks) + PWA
                          # (manifest.webmanifest, sw.js, icons/)
  scripts/               # utilidades de build (generate-icons.js)
```

Cada nota de `Biblioteca/` tiene frontmatter (`title`, `author`,
`originalLanguage`) y el cuerpo de la nota es la sinopsis del libro. Cada
nota de `Archivero/<libro>/` describe una edición concreta (`publisher`,
`country`, `language`, `year`, `cover`, `editorialDesign`, `illustrator`,
`illustratorUrl`, `sourceLink`, `sourceSite`) y enlaza a su libro mediante
el campo `book`. `editorialDesign`, `illustrator` e `illustratorUrl` son
opcionales: solo se muestran en la interfaz cuando la nota los incluye.
`illustrator` es el nombre de quien diseñó o ilustró esa portada (no una
descripción del diseño), pensado para dar crédito a la persona;
`illustratorUrl` es un enlace opcional a su portafolio.

Para trabajar con el catálogo desde Obsidian, abre la carpeta `coversign/`
como vault: cada libro y cada edición es una nota editable, y las imágenes
de `Covers/` se pueden insertar en cualquier nota con `![[Covers/...]]`.

### API

| Método | Ruta                        | Descripción                                    |
| ------ | --------------------------- | ----------------------------------------------- |
| GET    | `/api/books`                 | Lista todos los libros (edición destacada)      |
| GET    | `/api/search?q=texto`         | Busca por título, autor, editorial o país       |
| GET    | `/api/books/:id`              | Detalle de un libro con todas sus ediciones     |
| GET    | `/api/lookup?isbn=...`        | Autocompleta datos desde Google Books por ISBN  |
| POST   | `/api/books`                  | Crea un libro nuevo con su primera edición      |
| POST   | `/api/books/:id/editions`     | Agrega una edición a un libro existente         |

Los dos `POST` aceptan `multipart/form-data`: si se envía el campo de
archivo `coverFile`, la imagen se guarda en `Covers/<libro>/`; si en cambio
se envía `coverUrl`, se enlaza esa URL externa sin descargarla. Si el
servidor corre detrás de un proxy HTTP(S), `/api/lookup` lo usa
automáticamente a partir de la variable de entorno `HTTPS_PROXY`.

## Uso

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:3000`. Para
regenerar los íconos de la PWA: `node scripts/generate-icons.js`.

## Publicarlo como sección de otro sitio

coversign necesita un proceso Node corriendo (no es un sitio estático),
así que para incrustarlo en un sitio existente hay dos caminos: alojar
este servidor aparte (tu propio VPS, Railway, Render, Fly.io, etc.) y
exponerlo en una subruta o subdominio de tu dominio principal mediante un
proxy inverso (nginx, Apache, o el de tu hosting); o, si no querés tocar
la infraestructura del sitio principal, embeberlo con un `<iframe>` que
apunte a donde esté alojado.
