# Porra Mundial 2026 local

App local para ver las porras importadas desde Excel, comparar resultados con marcadores reales y ver la clasificacion real al lado de cada porra.

Ahora incluye selector de participante:

- Miguel
- Gonzalo

## Arrancar

```powershell
npm start
```

Luego abre:

```text
http://127.0.0.1:4173
```

## Publicarlo gratis

La opcion recomendada es Vercel Hobby:

1. Crea una cuenta en Vercel.
2. Sube esta carpeta a un repositorio de GitHub.
3. En Vercel, pulsa `Add New Project` e importa el repo.
4. No hace falta build command.
5. La app queda publicada con una URL tipo `https://tu-proyecto.vercel.app`.

El proyecto ya incluye funciones `/api/live`, `/api/predictions` y `/api/health` para que funcione fuera de local sin token de ESPN.

Si no quieres subir nada a GitHub y solo quieres enseñarlo un rato, puedes usar un tunel gratis como Cloudflare Tunnel, pero tu PC tiene que estar encendido y con el servidor local arrancado.

## Resultados reales

La app usa ESPN por defecto, sin token:

- API: `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`
- Liga: `fifa.world`
- Temporada: `2026`

Football-Data queda como respaldo opcional:

- Competicion: `WC`
- Temporada: `2026`
- Endpoints usados: partidos y clasificacion

Si quieres usar Football-Data, puedes pegar el token en la app o arrancar con:

```powershell
$env:FOOTBALL_DATA_TOKEN="tu_token"
npm start
```

## Puntuacion

La app calcula puntos con el PDF de puntuacion:

- Primera fase: 1X2, marcador exacto, posiciones de grupo y clasificados a dieciseisavos.
- Partidos de Espana en primera fase: doble puntuacion de marcador.
- Eliminatorias: 1X2, marcador exacto y equipos que pasan de ronda.
- Semifinales: finalistas y equipos del 3º/4º puesto.
- Final: campeon y subcampeon.

En eliminatorias, si el cruce real no coincide con tu cruce previsto, no se dan puntos de marcador para ese partido; si uno de tus equipos si aparece en el cruce real, se marca en verde.

## Reimportar los Excel

```powershell
python scripts\extract_excel.py
```

Eso regenera `data/predictions.json` con las porras de Miguel y Gonzalo.

Si quieres importar un unico Excel:

```powershell
python scripts\extract_excel.py "C:\ruta\a\porra.xlsx" --id nombre --name "Nombre"
```
