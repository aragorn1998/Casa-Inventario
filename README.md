# Inventario compartido con token

Esta carpeta replica el flujo del inventario anterior, pero está pensada para que cualquiera que tenga el token pueda subir imágenes desde su propio móvil o navegador.

## Qué hace
- Lee y escribe el archivo `inventario.json` en GitHub.
- Permite añadir, editar y eliminar objetos.
- Guarda las imágenes como datos en base64 dentro del propio JSON.
- Requiere un token personal de GitHub con permisos de escritura sobre el repositorio.

## Ajustes rápidos
1. Abre [app.github.js](app.github.js) y revisa las constantes `OWNER`, `REPO` y `BRANCH`.
2. Asegúrate de que el repositorio existe y que tu token tiene permisos de escritura.
3. Abre `index.html` en el navegador.
4. Pulsa el botón de token y pega el token.
5. Ya podrás añadir objetos y subir fotos desde cualquier dispositivo.
