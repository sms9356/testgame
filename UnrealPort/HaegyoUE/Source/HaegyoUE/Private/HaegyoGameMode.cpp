#include "HaegyoGameMode.h"
#include "HaegyoCharacter.h"
#include "HaegyoDoor.h"
#include "HaegyoSaveGame.h"
#include "EngineUtils.h"
#include "Kismet/GameplayStatics.h"

const FString AHaegyoGameMode::MainSlot = TEXT("Haegyo_Main");
const FString AHaegyoGameMode::BackupSlot = TEXT("Haegyo_Backup");

AHaegyoGameMode::AHaegyoGameMode() { DefaultPawnClass = AHaegyoCharacter::StaticClass(); }

bool AHaegyoGameMode::SaveGame()
{
	AHaegyoCharacter* C = Cast<AHaegyoCharacter>(UGameplayStatics::GetPlayerPawn(this, 0));
	if (!C) return false;
	if (USaveGame* Prev = UGameplayStatics::LoadGameFromSlot(MainSlot, 0)) UGameplayStatics::SaveGameToSlot(Prev, BackupSlot, 0);   // 이전 저장을 백업으로
	UHaegyoSaveGame* S = Cast<UHaegyoSaveGame>(UGameplayStatics::CreateSaveGameObject(UHaegyoSaveGame::StaticClass()));
	S->PlayerTransform = C->GetActorTransform(); S->Battery = C->Battery; S->SavedAt = FDateTime::Now();
	for (TActorIterator<AHaegyoDoor> It(GetWorld()); It; ++It) S->DoorOpen.Add(It->DoorId, It->Target);
	return UGameplayStatics::SaveGameToSlot(S, MainSlot, 0);
}

bool AHaegyoGameMode::LoadGame(bool bPreferBackup)
{
	UHaegyoSaveGame* S = Cast<UHaegyoSaveGame>(UGameplayStatics::LoadGameFromSlot(bPreferBackup ? BackupSlot : MainSlot, 0));
	if (!S && !bPreferBackup) S = Cast<UHaegyoSaveGame>(UGameplayStatics::LoadGameFromSlot(BackupSlot, 0));   // 손상 · 없음 → 백업
	if (!S || S->SchemaVersion > UHaegyoSaveGame::CurrentSchema) return false;
	if (AHaegyoCharacter* C = Cast<AHaegyoCharacter>(UGameplayStatics::GetPlayerPawn(this, 0))) { C->SetActorTransform(S->PlayerTransform); C->Battery = S->Battery; }
	for (TActorIterator<AHaegyoDoor> It(GetWorld()); It; ++It) if (const float* V = S->DoorOpen.Find(It->DoorId)) { It->Target = *V; It->Open = *V; It->Apply(); }
	return true;
}
