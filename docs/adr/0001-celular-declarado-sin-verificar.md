---
status: accepted
---

# El celular identifica a la Persona, declarado y sin verificar

Cada Persona se reconoce por el número de celular que escribe al anotarse; la app no comprueba que el número sea suyo y no hay login. Lo decidimos (2026-10-03) porque el problema real es el desorden, no el fraude: apodos distintos en cada evento, duplicados que los admins limpian a mano y cuentas corrientes partidas. Anotarse tiene que seguir llevando unos segundos desde el grupo de WhatsApp, también para un externo que viene una sola vez.

## Opciones consideradas

- **Verificar el número por WhatsApp** (la persona manda un mensaje a un número del club): descartada por ahora. Requiere un número dedicado, cuenta de Meta Business y un endpoint que reciba los avisos. Se puede sumar después sin cambiar el modelo.
- **Código por SMS o WhatsApp**: servicio pago y un paso más para cada externo.
- **Entrar con Google**: verifica un mail, que en el club no se usa para nada.
- **DNI**: no se puede verificar, es un dato sensible y nadie lo da para un asado.
- **Solo nombre, elegido de una lista**: no resuelve los apodos ni los externos nuevos.

## Consecuencias

- Quien sepa el número de otro puede anotarse o subir un comprobante en su nombre. No se impide: se detecta. El admin ve desde qué teléfono se subió cada comprobante.
- Un número mal escrito crea una Persona duplicada hasta que un admin la fusiona. Por eso fusionar Personas es parte del diseño y no un extra.
- Un mismo número puede tener más de una Persona (quien anota a otro desde su teléfono), así que el celular no es una clave única.
- Ningún mecanismo de identidad evita un comprobante falso propio; eso requeriría controlar los pagos contra el banco.
