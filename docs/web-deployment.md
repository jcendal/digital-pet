# Despliegue de Web Digital Pet en AWS

La web pública usa `https://digital-pet.rebase.es`. Es un origen distinto de
`rebase.es`, por lo que la web corporativa y su distribución CloudFront no se
modifican. Este despliegue sirve **THIS BROWSER**: la partida se guarda en el
IndexedDB de cada navegador. **COMPUTER SAVE** necesita el servidor local y
`pet.db`, por lo que no aparece como disponible en AWS.

## Qué vas a hacer

Este procedimiento se realiza en la **misma cuenta de AWS** que contiene la
zona pública de Route 53 para `rebase.es`. Necesitas acceso a esa cuenta para
crear recursos de CloudFormation, ACM, S3, CloudFront, Route 53 e IAM, y
permisos de escritura en `github.com/jcendal/digital-pet`. No compartas claves
de acceso ni contraseñas en el chat: GitHub se autenticará mediante OIDC.

La [plantilla de infraestructura](../infra/web-digital-pet.yml) crea todos los
recursos de AWS: bucket S3 privado, certificado HTTPS, distribución CloudFront,
registros DNS A/AAAA y rol de publicación para GitHub. Vas a subir **una sola
plantilla** a CloudFormation. La distribución corporativa de `rebase.es`
permanece como está.

### Paso 1. Localiza la zona DNS correcta

1. Entra en la [consola de Route 53](https://console.aws.amazon.com/route53/)
   con la cuenta donde ya está `rebase.es`.
2. En el menú lateral, abre **Hosted zones** (Zonas alojadas).
3. Busca `rebase.es` y abre la zona cuyo tipo sea **Public hosted zone**.
   Si aparecen una zona pública y otra privada, usa la pública.
4. Copia el **Hosted zone ID**. Se parece a `Z0123456789ABCDEF`. Guarda solo
   el identificador; CloudFormation no necesita `/hostedzone/` delante.
5. En la lista de registros de esa zona, busca `digital-pet.rebase.es`.
   Si ya existe un registro A, AAAA o CNAME para ese nombre, detén la creación
   y revisa a qué apunta: la plantilla intentaría crear registros con el mismo
   nombre. Los registros actuales de `rebase.es` y `www.rebase.es` no se tocan.

Referencia: [listar zonas públicas de Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ListInfoOnHostedZone.html).

### Paso 2. Comprueba el proveedor de identidad de GitHub

1. Abre la [consola de IAM](https://console.aws.amazon.com/iam/).
2. En el menú lateral, abre **Identity providers** (Proveedores de identidad).
3. Busca `token.actions.githubusercontent.com`.
4. Si aparece, ábrelo y copia su **ARN** completo, con formato
   `arn:aws:iam::<id-de-cuenta>:oidc-provider/token.actions.githubusercontent.com`.
   Lo introducirás en el paso 3.
5. Si no aparece, no crees nada aquí: deja vacío el parámetro correspondiente
   en el paso 3 y la plantilla lo creará.

El rol de la plantilla acepta el sujeto OIDC de
`jcendal/digital-pet` en `main` y la audiencia `sts.amazonaws.com`.
Referencia: [OIDC de GitHub en IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html).

### Paso 3. Crea el stack en CloudFormation

1. En el selector de región de la parte superior de AWS, elige **US East
   (N. Virginia) — us-east-1**. CloudFront necesita que el certificado ACM
   del subdominio esté en esa región.
2. Abre [CloudFormation](https://console.aws.amazon.com/cloudformation/) y
   comprueba que la región mostrada sigue siendo `us-east-1`.
3. Pulsa **Create stack → With new resources (standard)**.
4. En **Prerequisite — Prepare template**, marca **Choose an existing
   template**. En **Specify template**, marca **Upload a template file**.
5. Pulsa **Choose file** y selecciona el archivo local
   [`infra/web-digital-pet.yml`](../infra/web-digital-pet.yml). Pulsa **Next**.
6. En **Stack name**, escribe `digital-pet-web`.
7. En **Parameters**, rellena los tres campos:

   | Parámetro | Valor |
   | --- | --- |
   | `RebaseHostedZoneId` | ID copiado en el paso 1, sin `/hostedzone/`. |
   | `ExistingGitHubOidcProviderArn` | ARN copiado en el paso 2, o vacío si no existía. |
   | `GitHubOidcSubject` | Conserva `repo:jcendal/digital-pet:ref:refs/heads/main`. |

   Si la organización configuró sujetos OIDC personalizados en GitHub,
   sustituye el valor del último campo por el sujeto exacto configurado allí.
   No uses comodines.
8. Pulsa **Next**. En **Configure stack options**, deja las opciones
   predeterminadas. En **Capabilities**, marca **I acknowledge that AWS
   CloudFormation might create IAM resources**: la plantilla crea el rol
   limitado que utilizará GitHub. Pulsa **Next**.
9. En **Review and create**, comprueba nombre, región, plantilla y parámetros.
   Pulsa **Submit**. La consola puede mostrar **Create stack** en lugar de
   **Submit**; usa el botón final de creación.

Referencia: [crear un stack desde la consola](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stack.html)
y [requisito regional del certificado de CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html).

### Paso 4. Espera y recoge las salidas del stack

1. Abre el stack `digital-pet-web` y entra en la pestaña **Events**.
2. Espera hasta que el estado del **stack** sea `CREATE_COMPLETE`. El
   certificado se valida mediante un registro DNS que CloudFormation añade a
   la zona pública de Route 53 en esta misma cuenta; durante la validación
   puede verse `CREATE_IN_PROGRESS`.
3. Si aparece `CREATE_FAILED` o `ROLLBACK_IN_PROGRESS`, abre el evento fallido
   más reciente y lee **Status reason**. Corrige esa causa antes de volver a
   crear o actualizar el stack. No continúes al paso 5 sin `CREATE_COMPLETE`.
4. Abre la pestaña **Outputs** y copia estos valores exactamente:

   | Output | Qué representa |
   | --- | --- |
   | `BucketName` | Bucket privado donde se publica la web. |
   | `DistributionId` | Distribución CloudFront de Digital Pet. |
   | `DeployRoleArn` | Rol temporal que asumirá GitHub Actions. |
   | `SiteUrl` | URL final de la web. |

5. Vuelve a Route 53 → zona pública `rebase.es` y comprueba que se han creado
   dos registros `digital-pet.rebase.es`: uno **A** y otro **AAAA**. Ambos son
   alias de la nueva distribución CloudFront. El certificado de ACM debe
   figurar como **Issued** en `us-east-1`.

Antes de subir la web, la URL puede responder **403** porque el bucket aún no
tiene `index.html`. El bucket tiene bloqueo de acceso público: no habilites
acceso público para resolver ese 403.

Referencias: [eventos y estado de CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/view-stack-events.html)
y [validación DNS automática del certificado](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-certificatemanager-certificate.html).

### Paso 5. Configura las variables en GitHub

1. Abre [`jcendal/digital-pet`](https://github.com/jcendal/digital-pet) en
   GitHub y entra en **Settings**.
2. En el menú lateral, abre **Secrets and variables → Actions**.
3. Selecciona la pestaña **Variables** y pulsa **New repository variable**.
4. Crea estas tres variables **de repositorio**, una por una. En cada una,
   escribe **Name**, pega **Value** y pulsa **Add variable**:

   | Name | Value: copia este Output de CloudFormation |
   | --- | --- |
   | `AWS_ROLE_ARN` | `DeployRoleArn` |
   | `WEB_BUCKET_NAME` | `BucketName` |
   | `WEB_DISTRIBUTION_ID` | `DistributionId` |

5. Comprueba en la lista de **Variables** que figuran los tres nombres. Son
   identificadores de recursos, no claves de acceso. No hace falta crear
   secretos `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY`.

Referencia: [crear variables de repositorio en GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

### Paso 6. Publica el código y ejecuta el primer despliegue

1. Asegúrate de que los cambios de este despliegue, incluido
   [`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml),
   están **confirmados y presentes en la rama `main` de GitHub**. Los cambios
   que solo estén en tu ordenador no son visibles para GitHub Actions.
2. Al llegar el cambio a `main`, el evento `push` ejecuta automáticamente
   **Deploy Digital Pet web**. Abre en GitHub **Actions → Deploy Digital Pet
   web** y selecciona la ejecución más reciente.
3. Entra en el trabajo **deploy**. Espera a que pasen, en este orden:
   instalación, comprobación y pruebas, compilación estática, autenticación
   OIDC, publicación en S3 e invalidación de CloudFront. El trabajo completo
   debe terminar en verde.
4. Si los cambios llegaron a `main` antes de crear el stack o las variables,
   o si necesitas repetir el despliegue, abre **Actions → Deploy Digital Pet
   web → Run workflow**, selecciona **main** y pulsa **Run workflow**.
5. La ejecución manual requiere que el archivo del workflow ya esté en la
   rama predeterminada. Si no aparece **Run workflow**, confirma primero que
   el archivo está en `main` y que Actions está habilitado en el repositorio.

Referencia: [ejecutar un workflow manualmente](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

### Paso 7. Comprueba la web publicada

1. Abre `https://digital-pet.rebase.es/` en una ventana normal del navegador.
   Debe cargar por HTTPS sin aviso de certificado y mostrar Digital Pet.
2. Abre directamente `https://digital-pet.rebase.es/dex` y
   `https://digital-pet.rebase.es/history`; actualiza cada página. Deben
   seguir cargando correctamente.
3. En **OPTIONS**, comprueba que **THIS BROWSER** está disponible. Es la
   partida del navegador. **COMPUTER SAVE** no estará disponible en AWS
   porque depende del servidor local y de `pet.db`.
4. Abre **OPTIONS → BACK UP YOUR SAVE → DOWNLOAD BACKUP** y comprueba que se
   descarga un JSON. Guarda ese archivo: sirve para recuperar la partida si
   se borran los datos del sitio o cambias de navegador.
5. Tras la primera carga completa, prueba la instalación de la PWA desde el
   navegador compatible. Cierra todas sus pestañas y vuelve a abrirla para
   comprobar que la nueva versión toma el control. En una comprobación de
   actualización posterior, confirma que la partida continúa en el mismo
   navegador.

La URL `https://rebase.es` debe seguir mostrando la web corporativa. En la
zona compartida, este stack añade los alias del subdominio y el registro de
validación del certificado.

### Si algo falla

| Lo que ves | Qué revisar primero |
| --- | --- |
| `CREATE_FAILED` en CloudFormation | Abre **Events**, busca el primer recurso fallido y lee **Status reason**. Revisa el ID de la zona, permisos para crear recursos y posibles registros DNS ya existentes. |
| El stack sigue en `CREATE_IN_PROGRESS` mientras espera el certificado | En ACM de `us-east-1`, comprueba si el certificado está **Pending validation** y si CloudFormation creó su CNAME en la zona pública correcta. La zona debe ser la que resuelve `rebase.es` en internet. |
| El trabajo de GitHub dice `Missing ... repository variable` | Vuelve a **Settings → Secrets and variables → Actions → Variables** y comprueba nombre y valor de las tres variables del paso 5. |
| Falla `AssumeRoleWithWebIdentity` | Comprueba que `AWS_ROLE_ARN` coincide con `DeployRoleArn`, que el proveedor OIDC está en esa cuenta y que el sujeto del rol corresponde exactamente a `jcendal/digital-pet` en `main`. |
| La web responde 403 después de un trabajo verde | Revisa que `index.html` está en la raíz del bucket indicado por `WEB_BUCKET_NAME`, que `WEB_DISTRIBUTION_ID` es la distribución del stack y que CloudFront terminó su despliegue. Mantén privado el bucket. |
| Ves una versión anterior de la PWA | Cierra todas las pestañas y ventanas de Digital Pet y vuelve a abrirla. El service worker nuevo espera a que se cierre la versión anterior. |

Si inspeccionas una partida para diagnosticar un problema, descarga primero
su respaldo desde **OPTIONS**. Borrar los datos del sitio también borra
IndexedDB y puede eliminar el progreso.

## Qué compila y qué sube

El workflow obtiene el commit de `main`, instala sus dependencias con
`npm ci`, comprueba tipos y pruebas, y ejecuta `build:static`. `esbuild`
convierte el TypeScript y los paquetes compartidos del repositorio en
JavaScript para el navegador. La exportación genera HTML, JavaScript,
imágenes, fuentes, `manifest.webmanifest` y `service-worker.js` en
`packages/web-digital-pet/dist-static`. S3 recibe **solo esa carpeta
compilada**. No se suben los `.ts`, `node_modules`, el servidor Node ni
`pet.db`.

Primero se suben los archivos de la nueva revisión bajo `revisions/<hash>/`;
después el resto de recursos y, al final, `index.html` y el service worker.
El workflow conserva revisiones anteriores para las pestañas que sigan
abiertas. Los archivos de revisión tienen caché larga porque su URL cambia
cuando cambia el contenido. `index.html` y el service worker se revalidan;
CloudFront invalida su caché tras la publicación. La nueva PWA espera a que
se cierren las pestañas de la versión anterior para tomar el control.

## Partidas y actualizaciones

**THIS BROWSER** guarda la partida en IndexedDB bajo el origen
`https://digital-pet.rebase.es`. Una publicación nueva no borra esa base de
datos ni cambia el origen. La partida sigue ahí después de actualizar y
reabrir la PWA. `rebase.es`, `localhost` y otros dispositivos tienen
almacenamientos separados.

El usuario sí puede perder datos si borra los datos del sitio, usa navegación
privada o el navegador libera almacenamiento. En **OPTIONS → BACK UP YOUR
SAVE** puede descargar un JSON de respaldo e importarlo después. La
importación valida el archivo, pide confirmación y guarda la partida previa
para restaurarla desde la misma pantalla. Conviene descargar un respaldo
antes de cambiar de navegador o dispositivo.

## Cómo funciona

- `npm run build:static --workspace @jcendal/web-digital-pet` produce
  `packages/web-digital-pet/dist-static` sin arrancar el servidor local.
- `npm ci` enlaza `@jcendal/digital-pet-core`, `animation`, `fields` y
  `webviews` a las carpetas `packages/` del **mismo commit de `main`**. Son
  paquetes privados del monorepo, no versiones de npm. Sus etiquetas `-dev.0`
  sirven para comprobar la coherencia interna; el workflow valida que
  coincidan. Poner `latest` intentaría descargar paquetes que no se publican
  y perdería la relación exacta entre código y despliegue.
- CloudFront traduce las rutas `/dex`, `/history`, `/view/*` y las
  respuestas fijas de `/api/*` a objetos estáticos. El navegador mantiene
  los datos de juego localmente.
- [`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml)
  se ejecuta para cambios web en `main` y también manualmente. El rol IAM
  solo puede escribir en este bucket e invalidar esta distribución.
- El stack debe instalarse en `us-east-1` porque CloudFront exige allí los
  certificados ACM de dominios personalizados.
