import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonContent, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonButton,
  IonIcon
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { serverOutline } from 'ionicons/icons';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonContent, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButton,
    IonIcon
  ]
})
export class HomePage {

  constructor(private firestore: Firestore) {
    addIcons({
      'server-outline': serverOutline 
    });
  }

  async probarConexionFirebase() {
    try {
      const colRef = collection(this.firestore, 'test-conexion');
      await addDoc(colRef, {
        mensaje: '¡Conexión exitosa desde ExpertiMente!',
        usuario: 'Prueba de conexión',
        fecha: new Date()
      });
      console.log('¡Documento de prueba enviado con éxito a Firestore!');
      alert('¡Conexión exitosa! Revisa tu base de datos en Firebase.');
    } catch (error) {
      console.error('Error al conectar con Firestore:', error);
      alert('Hubo un error al conectar. Revisa la consola (F12).');
    }
  }
}