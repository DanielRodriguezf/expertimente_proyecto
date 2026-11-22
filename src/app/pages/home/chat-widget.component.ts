import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonFab,
  IonFabButton,
  IonIcon,
  IonBadge,
  IonButton,
  IonAvatar,
  IonItem,
  IonLabel,
  IonInput
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import { chatbubblesOutline, closeOutline, arrowBackOutline, sendOutline } from 'ionicons/icons';

interface Mensaje {
  texto: string;
  mio: boolean;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonFab,
    IonFabButton,
    IonIcon,
    IonBadge,
    IonButton,
    IonAvatar,
    IonItem,
    IonLabel,
    IonInput
  ]
})
export class ChatWidgetComponent {
  chatAbierto = false;
  conversacionActiva: string | null = null;
  nuevoMensaje = '';

  mensajes: Mensaje[] = [
    { texto: 'Hola, vi la postulación para el cargo de Gastronomía.', mio: false },
    { texto: 'Hola Daniel, excelente. ¿Tienes disponibilidad inmediata?', mio: true }
  ];

  constructor() {
    addIcons({
      'chatbubbles-outline': chatbubblesOutline,
      'close-outline': closeOutline,
      'arrow-back-outline': arrowBackOutline,
      'send-outline': sendOutline
    });
  }

  toggleChat() {
    this.chatAbierto = !this.chatAbierto;
  }

  abrirConversacion(nombre: string) {
    this.conversacionActiva = nombre;
  }

  volverBandeja() {
    this.conversacionActiva = null;
  }

  enviarMensaje() {
    if (this.nuevoMensaje.trim()) {
      this.mensajes.push({ texto: this.nuevoMensaje, mio: true });
      this.nuevoMensaje = '';
    }
  }
}