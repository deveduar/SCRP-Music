# problema ui en pantallas muy pequeñas en la pagina browse
- en el filter en pantallas pequeñas se generan 4 filas lo cual consume demasiado tamaño
  - es debido al boton load json que esta alineado a la derecha, en pantallas grandes y medianas se ve bien peroo no en pantallas pequeñas
  - cuando pasa compact view a la siguiente fila load json deberia seguir continuo despues de ese boton en vez de un espacio desaprovechado, siguiente deberia seguir filter y el resto de boton sin grandes espacios en medio lo que hace mucho espacio desaprovechado en pantallas pequeñas, necesitamos una solucion
  - compact view y full bien podria constar de dos iconos en vez de tecxto (este cambio aplica a a todas las pantallas)

# ideas 

- funcionalidad y plantear la posibilidad de meter adapters directamente en la app sin tener que recompilar, que cambios osn necesarios en la arquitectura y que implica, crear una pagina para creacion de adpaters? o quizas en un text area meter el codigo?
  - quizas para realizar esto tenemos que tener claro todos los componentes servicios que se veran afectados por este mayor change sopesemoslo
- plantear usar un archivo env por si el user quiere desplegar en otros entornos ademas de vercel ya hemos comprovador que mi adapter funcion
- posibilidad de desplegar en docker para los user es viable?
  - pregunta: ahora mismo el proyecto consta de varias partes un server en la carpeta api no?
- crear documentacion Deploy.md donde pondremos todos los posibles metodos de deploy ademas se hablar asobre las distintas conf de proxy, relay, etc, archicture,md o C:\Docs Hp 2\A0-Projects\sccrp-muzic\doc_deploy_relay.md podrian servir de referencia aunque quizas tambien el codigo de la app para poder crear esta documentacion