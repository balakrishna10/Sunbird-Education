import { Injectable, Inject } from '@angular/core';
import { PopoverController, Events } from '@ionic/angular';
import { Subject } from 'rxjs';
import { ContentService, InteractType, Content, ContentDeleteStatus } from 'sunbird-sdk';

import { TelemetryGeneratorService } from '@app/services/telemetry-generator.service';
import { InteractSubtype, Environment, PageId, ImpressionType } from '@app/services/telemetry-constants';
import { CommonUtilService } from '@app/services/common-util.service';
import { FileSizePipe } from '@app/pipes/file-size/file-size';
import { ContentInfo } from './content-info';
import { SbPopoverComponent } from '@app/app/components/popups/sb-popover/sb-popover.component';

@Injectable({
    providedIn: 'root'
})
export class ContentDeleteHandler {
    private contentDelete = new Subject<any>();
    public contentDeleteCompleted$ = this.contentDelete.asObservable();

    constructor(
        @Inject('CONTENT_SERVICE') private contentService: ContentService,
        private telemetryGeneratorService: TelemetryGeneratorService,
        private commonUtilService: CommonUtilService,
        private fileSizePipe: FileSizePipe,
        private popoverCtrl: PopoverController,
        private events: Events
    ) { }

    /**
     * Shows Content Delete popup
     */
    public async showContentDeletePopup(content: Content, isChildContent: boolean, contentInfo: ContentInfo, pageId: string) {
        this.telemetryGeneratorService.generateImpressionTelemetry(ImpressionType.VIEW, pageId,
            PageId.SINGLE_DELETE_CONFIRMATION_POPUP,
            Environment.HOME,
            contentInfo.telemetryObject.id,
            contentInfo.telemetryObject.type,
            contentInfo.telemetryObject.version,
            contentInfo.rollUp,
            contentInfo.correlationList);
        const confirm = await this.popoverCtrl.create({
            component: SbPopoverComponent,
            componentProps: {
                content,
                isChild: isChildContent,
                objRollup: contentInfo.rollUp,
                pageName: PageId.CONTENT_DETAIL,
                corRelationList: contentInfo.correlationList,
                sbPopoverHeading: this.commonUtilService.translateMessage('DELETE'),
                sbPopoverMainTitle: this.commonUtilService.translateMessage('CONTENT_DELETE'),
                actionsButtons: [
                    {
                        btntext: this.commonUtilService.translateMessage('REMOVE'),
                        btnClass: 'popover-color'
                    },
                ],
                icon: null,
                metaInfo: content.contentData.name,
                sbPopoverContent: ' 1 item' + ' (' + this.fileSizePipe.transform(content.sizeOnDevice, 2) + ')',
            },
            cssClass: 'sb-popover danger',
        });
        await confirm.present();
        const { data } = await confirm.onDidDismiss();
        if (data && data.canDelete) {
            this.deleteContent(content.identifier, isChildContent, contentInfo, pageId);
        }
    }

    /**
     * Deletes the content
     */
    private deleteContent(identifier: string, isChildContent: boolean, contentInfo: ContentInfo, pageId: string) {
        this.telemetryGeneratorService.generateInteractTelemetry(
            InteractType.TOUCH,
            InteractSubtype.DELETE_CLICKED,
            Environment.HOME,
            pageId,
            contentInfo.telemetryObject,
            undefined,
            contentInfo.rollUp,
            contentInfo.correlationList);
        const deleteContentRequest = {
            contentDeleteList: [{
                contentId: identifier,
                isChildContent
            }]
        };
        const loader = this.commonUtilService.getLoader();
        loader.present();
        this.contentService.deleteContent(deleteContentRequest).toPromise().then((res: any) => {
            loader.dismiss();
            if (res && res.status === ContentDeleteStatus.NOT_FOUND) {
                this.commonUtilService.showToast('CONTENT_DELETE_FAILED');
            } else {
                // Publish saved resources update event
                this.events.publish('savedResources:update', {
                    update: true
                });
                this.contentDelete.next();
                this.commonUtilService.showToast('MSG_RESOURCE_DELETED');
            }
        }).catch((error: any) => {
            loader.dismiss();
            console.log('delete response: ', error);
            this.commonUtilService.showToast('CONTENT_DELETE_FAILED');
        });
    }
}
