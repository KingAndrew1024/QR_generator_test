import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { QRScanner, QRScannerStatus } from '@ionic-native/qr-scanner/ngx';
import { Platform, IonRadioGroup, LoadingController, ToastController, AlertController, ActionSheetController } from '@ionic/angular';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { File } from '@ionic-native/file/ngx';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('linkGroup') radioGroup: IonRadioGroup

  linkList = [
    'http://dulceriamx.com.mx/',
    'https://virket.com/',
    'https://www.totalplay.com.mx/'
  ]
  selectedLink: string = "";
  qrText: string;

  scanSub: any;
  elementType = 'url';
  qrValue = '';
  zoom = 50;

  constructor(
    public platform: Platform,
    private iap: InAppBrowser,
    private qrScanner: QRScanner,
    private file: File,
    private loaderCtrl: LoadingController,
    private alertCtrl: AlertController,
    private actionSheetController: ActionSheetController,    private cdr: ChangeDetectorRef
  ) {
    this.platform.backButton.subscribeWithPriority(0, () => {
      document.getElementsByTagName('body')[0].style.opacity = '1';
      this.scanSub.unsubscribe();
    });

    this.platform.ready().then(() => {
      if (this.platform.is('android')) {
        this.isAndroid = true;
        this.folderpath = this.file.externalRootDirectory;
      }
      else {
        this.isAndroid = false;
        this.folderpath = this.file.documentsDirectory;
      }
    })

    /*setTimeout(() => {
      console.log("applicationDirectory",this.file.applicationDirectory);
      console.log("applicationStorageDirectory",this.file.applicationStorageDirectory);
      console.log("dataDirectory",this.file.dataDirectory);
      console.log("cacheDirectory",this.file.cacheDirectory);
      console.log("externalApplicationStorageDirectory",this.file.externalApplicationStorageDirectory);
      console.log("externalDataDirectory",this.file.externalDataDirectory);
      console.log("externalCacheDirectory",this.file.externalCacheDirectory);
      console.log("externalRootDirectory",this.file.externalRootDirectory);
      console.log("tempDirectory",this.file.tempDirectory);
      console.log("syncedDataDirectory",this.file.syncedDataDirectory);
      console.log("documentsDirectory",this.file.documentsDirectory);
    }, 5000);*/
  }

  folderpath: string;
  isAndroid: boolean;

  checkEvent(link: string) {
    this.selectedLink = link;

    this.qrText = '';
    this.qrValue = null
    this.zoom = 50;
  }

  createQr(link: string) {
    this.qrValue = link;

    setTimeout(() => {
      const child = document.getElementsByClassName('aclass')[0].firstElementChild.firstElementChild

      if (child) {
        const src = child.getAttribute('src');
        if (src) {
          var a = document.getElementById("downladableQr"); //Create <a>
          a.setAttribute('src', src);
        }
        else {
          console.log("--- No img src found");
        }
      }
      else {
        console.log("--- Element not found");
      }
    }, 800);
  }

  openLink() {
    this.iap.create(this.qrText, "_blank");
  }

  startScanning() {
    this.selectedLink = '';
    this.qrValue = '';

    // Optionally request the permission early
    this.qrScanner.prepare().
      then((status: QRScannerStatus) => {
        if (status.authorized) {
          this.qrScanner.show();
          this.scanSub = document.getElementsByTagName('body')[0].style.opacity = '0';
          this.scanSub = this.qrScanner.scan()
            .subscribe((textFound: string) => {
              document.getElementsByTagName('body')[0].style.opacity = '1';
              this.qrScanner.hide();
              this.scanSub.unsubscribe();

              this.qrText = textFound;

              this.cdr.detectChanges();
            }, (err) => {
              alert(JSON.stringify(err));
            });

        } else if (status.denied) {
        } else {

        }
      })
      .catch((e: any) => console.log('Error is', e));
  }

  setQrZoom(value: number) {
    const child = document.getElementsByClassName('aclass')[0].firstElementChild.firstElementChild
    child.setAttribute('style', `width: ${value}%`)
  }


  async saveImage(src: HTMLElement) {

    let option: 500 | 700 | 1200;

    const actionSheet = await this.actionSheetController.create({
      header: "Opciones",
      buttons: [{
        text: '500 x 500',
        handler: () => { option = 500}
      },
      {
        text: '700 x 700',
        handler: () => { option = 700}
      },
      {
        text: '1200 x 1200',
        handler: () => { option = 1200}
      }]
    });

    actionSheet.present();

    await actionSheet.onDidDismiss();

    if(!option) {return};
    

    const loader = await this.loaderCtrl.create();

    loader.present();

    const scaledImg = await this.scaleImage(src.getAttribute('src'), option, option)
      .catch(error => {
        this.alertCtrl.create({
          header: "Error",
          message: "No se pudo reescalar la imagen<br>" + JSON.stringify(error),
          buttons: [{ text: "Aceptar" }]
        })

        loader.dismiss();
      })

    if (!scaledImg) { return; }

    const block = (<string>scaledImg).split(";");

    // Get the content type
    const dataType = block[0].split(":")[1];

    // get the real base64 content of the file
    const realData = block[1].split(",")[1];

    // The name of your file, note that you need to know if is .png,.jpeg etc
    const filename = `MI_SITIO_WEB_${option}x${option}.${dataType.split("/")[1]}`;

    this.saveBase64(this.folderpath, realData, filename, dataType).then(path => {
      this.alertCtrl.create({
        header: 'Descarga',
        message: "Se descargó el archivo <b>" + filename + "</b> en el almacenamiento interno",
        buttons: [{ text: "Aceptar" }]
      }).then(a => a.present())
    }, error => {
      console.error("saveBase64: error", error);
      this.alertCtrl.create({
        message: 'No se pudo descargar el archivo<br>' + JSON.stringify(error),
        buttons: [{ text: "Aceptar" }]
      }).then(a => a.present())
    }).finally(() => this.loaderCtrl.dismiss());
  }

  /**
 * Convert a base64 string in a Blob according to the data and contentType.
 * 
 * @param b64Data {String} Pure base64 string without contentType
 * @param contentType {String} the content type of the file i.e (image/jpeg - image/png - text/plain)
 * @param sliceSize {Int} SliceSize to process the byteCharacters
 * @see http://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
 * @return Blob
 */
  b64toBlob(b64Data, contentType, sliceSize?) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    var byteCharacters = atob(b64Data);
    var byteArrays = [];

    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var slice = byteCharacters.slice(offset, offset + sliceSize);

      var byteNumbers = new Array(slice.length);
      for (var i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, { type: contentType });
    return blob;
  }

  public saveBase64(pictureDir: string, content: string, name: string, dataType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let blob = this.b64toBlob(content, dataType)

      this.file.writeFile(pictureDir, name, blob, { replace: true })
        .then(() => resolve(pictureDir + name))
        .catch((err) => {
          console.log('error writing blob. ERROR: ', err)
          reject(err)
        })
    })
  }

  scaleImage(base64Data: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      var img = new Image;
      img.onload = function () {
        // We create a canvas and get its context.
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');

        // We set the dimensions at the wanted size.
        canvas.width = width;
        canvas.height = height;

        // We resize the image with the canvas method drawImage();
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL());
      }

      img.onerror = ((e) => {
        reject(e.toString())
      })

      img.src = base64Data;
    })
  }
}
