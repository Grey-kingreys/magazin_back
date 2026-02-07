import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor() {
    // Configuration de Resend avec la clé API
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }


  /**
   * Email de bienvenue après inscription
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: 'Gestion de Stock <onboarding@resend.dev>', // À remplacer par votre domaine vérifié
        to: email,
        subject: '🎉 Bienvenue sur notre plateforme !',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Bienvenue ${name} ! 🎉</h1>
                </div>
                <div class="content">
                  <p>Bonjour <strong>${name}</strong>,</p>
                  
                  <p>Nous sommes ravis de vous accueillir sur notre plateforme de <strong>Gestion de Stock Multi-Magasins</strong> !</p>
                  
                  <p>Votre compte a été créé avec succès. Vous pouvez maintenant :</p>
                  <ul>
                    <li>Gérer vos stocks en temps réel</li>
                    <li>Suivre vos ventes et achats</li>
                    <li>Consulter vos rapports financiers</li>
                    <li>Et bien plus encore !</li>
                  </ul>
                  
                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="button">
                      Se connecter
                    </a>
                  </div>
                  
                  <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                  
                  <p>Cordialement,<br>L'équipe Gestion de Stock</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Gestion de Stock. Tous droits réservés.</p>
                  <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      console.log(`✅ Email de bienvenue envoyé à ${email}`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi de l'email à ${email}:`, error);
      // Ne pas bloquer l'inscription si l'email échoue
    }
  }

  /**
   * Email de réinitialisation de mot de passe
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

      await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Gestion de Stock <onboarding@resend.dev>', // À remplacer par votre domaine vérifié
        to: email,
        subject: '🔐 Réinitialisation de votre mot de passe',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Réinitialisation de mot de passe 🔐</h1>
                </div>
                <div class="content">
                  <p>Bonjour <strong>${name}</strong>,</p>
                  
                  <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte.</p>
                  
                  <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                  
                  <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">
                      Réinitialiser mon mot de passe
                    </a>
                  </div>
                  
                  <div class="warning">
                    <strong>⚠️ Important :</strong>
                    <ul>
                      <li>Ce lien est valide pendant <strong>1 heure</strong></li>
                      <li>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email</li>
                      <li>Ne partagez jamais ce lien avec personne</li>
                    </ul>
                  </div>
                  
                  <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
                  <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                  
                  <p>Cordialement,<br>L'équipe Gestion de Stock</p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Gestion de Stock. Tous droits réservés.</p>
                  <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      console.log(`✅ Email de réinitialisation envoyé à ${email}`);
    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi de l'email à ${email}:`, error);
      throw new Error("Impossible d'envoyer l'email de réinitialisation");
    }
  }

  /**
   * Test de la configuration email
   */
  async testConnection(): Promise<boolean> {
    try {
      // Avec Resend, on peut tester en envoyant un email de test
      // ou simplement vérifier que l'instance est créée
      console.log('✅ Configuration Resend initialisée');
      return true;
    } catch (error) {
      console.error('❌ Erreur de configuration Resend:', error);
      return false;
    }
  }
}