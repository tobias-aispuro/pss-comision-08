import nodemailer from 'nodemailer'

// Configurar transportador de email
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export type VueloComparativo = {
    campo: string
    anterior: unknown
    nuevo: unknown
}

export type DatosVuelo = {
    codigoVuelo: string
    origen: string
    destino: string
    diasOperacion: string[]
    horaSalida: string
    horaLlegada: string
    periodoDesde: string
    periodoHasta: string
    tipoAvion: string
}

function formatearDias(dias: string[]): string {
    return dias.join(', ')
}

function formatearValor(valor: unknown): string {
    if (Array.isArray(valor)) {
        return formatearDias(valor as string[])
    }
    return String(valor)
}

export async function enviarEmailEdicionVuelo(
    adminEmail: string,
    vueloAnterior: DatosVuelo,
    vueloNuevo: DatosVuelo,
    cambios: VueloComparativo[]
) {
    // Solo generar filas para los campos que fueron modificados
    const filasModificadas = cambios
        .map((cambio, index) => {
            const esParImpar = index % 2 === 0
            const bgColor = esParImpar ? '#f5f5f5' : 'white'
            return `
    <tr style="background-color: ${bgColor};">
      <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${cambio.campo}</td>
      <td style="padding: 10px; border: 1px solid #ffebee; background-color: #ffebee;">${formatearValor(cambio.anterior)}</td>
      <td style="padding: 10px; border: 1px solid #e8f5e9; background-color: #e8f5e9;">${formatearValor(cambio.nuevo)}</td>
    </tr>
            `
        })
        .join('')

    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          h2 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
          .cambios { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background-color: #1a73e8; color: white; padding: 10px; text-align: left; }
          .pie { color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Vuelo Editado en el Sistema</h2>
        
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th style="background-color: #ffebee; color: #525252">Dato Anterior</th>
                <th style="background-color: #e8f5e9; color: #525252">Dato Nuevo</th>
              </tr>
            </thead>
            <tbody>
              ${filasModificadas}
            </tbody>
          </table>

          <div class="pie">
            <p><strong>Fecha de edición:</strong> ${new Date().toLocaleString('es-ES')}</p>
            <p><em>Este es un mensaje automático del sistema Sky Link</em></p>
          </div>
        </div>
      </body>
    </html>
  `

    console.log(htmlContent);

    await transporter.sendMail({
        from: "noreply@skylink.com",
        to: adminEmail,
        subject: `Cambio en la información del vuelo ${vueloNuevo.codigoVuelo}`,
        html: htmlContent
    });
}